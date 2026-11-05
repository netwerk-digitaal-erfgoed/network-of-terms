import {
  Entity,
  RelatedTerm,
  Term,
} from '@netwerk-digitaal-erfgoed/network-of-terms-query';
import edtf from 'edtf';
import { calculateMatchingScore } from './score.js';
import { occupationEntities } from './entity-names.js';

/**
 * A column a client sends along with a reconciliation query, such as a person’s birth date, in
 * the `properties` of Reconciliation Service API 0.2.
 */
export type ReconciliationQueryProperty = {
  pid: string;
  v: PropertyValue | PropertyValue[];
};

/** A literal, or an entity the client reconciled before, such as a birthplace. */
export type PropertyValue =
  string | number | boolean | { id: string; name?: string };

/**
 * How well a candidate matches one property the client sent, from 0 for a contradiction to 1 for
 * a match. Undefined when the source states nothing to compare with, which is not a contradiction.
 */
export type PropertyComparison = { id: PropertyId; value: number | undefined };

/**
 * The properties a client can send, with the IDs of the data extension properties: OpenRefine
 * suggests them from the same service in its reconcile and its extend dialogs.
 */
export const propertyIds = [
  'givenNames',
  'familyNames',
  'birthDates',
  'deathDates',
  'birthPlaces',
  'deathPlaces',
  'genders',
  'occupations',
  'nationalities',
  'parents',
  'children',
  'spouses',
  'siblings',
] as const;

export type PropertyId = (typeof propertyIds)[number];

/**
 * Compare the properties a client sent with what the source states about the person a term
 * denotes. Properties the service does not know, and values it cannot read, such as a birth date
 * that is not a date, are left out: they say nothing about any candidate.
 */
export function compareProperties(
  term: Term,
  properties: ReconciliationQueryProperty[],
): PropertyComparison[] {
  return properties.flatMap(({ pid, v }) => {
    if (!isPropertyId(pid)) {
      return [];
    }
    const values = (Array.isArray(v) ? v : [v]).filter(isUsable);
    const comparisons = values.map((value) => compare[pid](value, term));
    if (comparisons.every((comparison) => comparison === unreadable)) {
      return [];
    }
    const known = comparisons.filter(
      (comparison): comparison is number => typeof comparison === 'number',
    );

    // Each value the client sent is an alternative, as are those the source states, so the best
    // of them counts.
    return [
      { id: pid, value: known.length > 0 ? Math.max(...known) : undefined },
    ];
  });
}

export const isPropertyId = (pid: string): pid is PropertyId =>
  (propertyIds as readonly string[]).includes(pid);

const isUsable = (value: PropertyValue) =>
  typeof value === 'object'
    ? value.id !== ''
    : typeof value !== 'boolean' && String(value).trim() !== '';

// A value the client sent that cannot be compared with anything, as opposed to a candidate that
// states nothing to compare it with.
const unreadable = Symbol('unreadable');
type Comparison = number | undefined | typeof unreadable;

type Candidate = { iri?: string; names: string[] };

const compare: Record<
  PropertyId,
  (value: PropertyValue, term: Term) => Comparison
> = {
  givenNames: (value, term) =>
    compareNames(value, literals(term.person?.givenNames)),
  familyNames: (value, term) =>
    compareNames(value, literals(term.person?.familyNames)),
  birthDates: (value, term) => compareDates(value, term.person?.birthDates),
  deathDates: (value, term) => compareDates(value, term.person?.deathDates),
  birthPlaces: (value, term) =>
    compareEntities(value, entities(term.person?.birthPlaces)),
  deathPlaces: (value, term) =>
    compareEntities(value, entities(term.person?.deathPlaces)),
  nationalities: (value, term) =>
    compareEntities(value, entities(term.person?.nationalities)),
  genders: (value, term) =>
    compareEntities(
      genderValue(value),
      entities(term.person?.genders).map(genderCandidate),
    ),
  occupations: (value, term) =>
    compareEntities(
      value,
      entities(occupationEntities(term.person?.occupations ?? [])),
    ),
  parents: (value, term) =>
    compareEntities(value, relatives(term.person?.parents)),
  children: (value, term) =>
    compareEntities(value, relatives(term.person?.children)),
  spouses: (value, term) =>
    compareEntities(value, relatives(term.person?.spouses)),
  siblings: (value, term) =>
    compareEntities(value, relatives(term.person?.siblings)),
};

const compareNames = (value: PropertyValue, names: string[]): Comparison => {
  const name = valueName(value);
  if (name === undefined) {
    return unreadable;
  }

  return names.length === 0 ? undefined : similarity(name, names);
};

/**
 * Dates match when they can mean the same day, whatever the precision of each: `1851` matches
 * `1851-03-02`, and the interval `1606-07-15/1607` matches `1607`. Sources and collections are
 * often a year apart, from a baptism date taken for a birth date or a slip in transcription, so a
 * date within a year of the other counts half.
 */
const compareDates = (
  value: PropertyValue,
  dates: string[] = [],
): Comparison => {
  const queried = parseDate(valueName(value));
  if (queried === undefined) {
    return unreadable;
  }
  const stated = dates.map(parseDate).filter((date) => date !== undefined);
  if (stated.length === 0) {
    return undefined;
  }

  return Math.max(
    ...stated.map((date) => {
      const gap = Math.max(date.min - queried.max, queried.min - date.max, 0);
      return gap === 0 ? 1 : gap <= year ? 0.5 : 0;
    }),
  );
};

const year = 366 * 24 * 60 * 60 * 1000;

const parseDate = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  try {
    const { min, max } = edtf(dateOf(value.trim()));
    // An open interval, such as `../1700`, says too little to compare.
    return Number.isFinite(min) && Number.isFinite(max)
      ? { min, max }
      : undefined;
  } catch {
    return undefined;
  }
};

// OpenRefine sends a date column as an ISO date-time, which EDTF reads as an instant rather than
// as the day it means. That day is the nearest midnight: a date parsed in Dutch time is sent as
// 23:00 UTC the day before.
const dateOf = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value;
  }
  const instant = Date.parse(value);

  return Number.isNaN(instant)
    ? value
    : new Date(instant + day / 2).toISOString().slice(0, 10);
};

const day = 24 * 60 * 60 * 1000;

/**
 * An entity the client reconciled matches the source’s entity with the same IRI. When the source
 * identifies it by another IRI, the two contradict each other, unless the client sent a name that
 * still matches. A name is compared with the names the source gives its entities.
 */
const compareEntities = (
  value: PropertyValue,
  candidates: Candidate[],
): Comparison => {
  if (candidates.length === 0) {
    return undefined;
  }
  const name = valueName(value);
  const iri = typeof value === 'object' ? value.id : undefined;
  if (
    iri !== undefined &&
    candidates.some((candidate) => candidate.iri === iri)
  ) {
    return 1;
  }
  const names = candidates.flatMap((candidate) => candidate.names);
  if (name !== undefined && names.length > 0) {
    return similarity(withoutQualifier(name), names.map(withoutQualifier));
  }

  return iri !== undefined &&
    candidates.some((candidate) => candidate.iri !== undefined)
    ? 0
    : undefined;
};

// Male and female are https://schema.org/Male and https://schema.org/Female, whatever the client
// or the source calls them: some sources state gender as a literal, such as ‘Vrouw’.
const genderValue = (value: PropertyValue): PropertyValue => {
  const iri = genderIri(typeof value === 'object' ? value.id : String(value));
  return iri === undefined ? value : { id: iri };
};

const genderCandidate = (candidate: Candidate): Candidate => {
  const iri = [candidate.iri, ...candidate.names]
    .map(genderIri)
    .find((gender) => gender !== undefined);
  return iri === undefined ? candidate : { iri, names: [] };
};

const genderIri = (label: string | undefined) => {
  const gender =
    genders[
      (label ?? '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\/schema\.org\//, '')
    ];
  return gender === undefined ? undefined : `https://schema.org/${gender}`;
};

const genders: Record<string, 'Male' | 'Female'> = Object.fromEntries([
  ...['male', 'm', 'man', 'mannelijk', 'masculine'].map((key) => [key, 'Male']),
  ...['female', 'f', 'v', 'woman', 'vrouw', 'vrouwelijk', 'feminine'].map(
    (key) => [key, 'Female'],
  ),
]);

const valueName = (value: PropertyValue) => {
  const name = typeof value === 'object' ? value.name : String(value);
  return name === undefined || name.trim() === '' ? undefined : name;
};

const similarity = (name: string, names: string[]) =>
  calculateMatchingScore(
    name.toLowerCase(),
    names.map((candidate) => candidate.toLowerCase()),
  ) / 100;

// Sources tell places apart with a qualifier that a client’s column lacks: ‘Leiden (stad)’.
const withoutQualifier = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

const literals = (values: { value: string }[] = []) =>
  values.map((literal) => literal.value);

const entities = (values: Entity[] = []): Candidate[] =>
  values.map((entity) => ({
    iri: entity.iri?.value,
    names: literals(entity.names),
  }));

const relatives = (values: RelatedTerm[] = []): Candidate[] =>
  values.map((relative) => ({
    iri: relative.id.value,
    names: literals(relative.prefLabels),
  }));
