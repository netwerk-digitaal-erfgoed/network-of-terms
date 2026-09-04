export const schema = (languages: string[]) => `
  """
  A term source is a collection of terms.
  """
  type Source {
    uri: ID!
    name: String!
    alternateName: String
    description: String!
    creators: [Creator]!
    features: [Feature]!
    genres: [Genre]!
    inLanguage: [Language]!
    mainEntityOfPage: [String]!
    status: SourceStatus
  }

  """
  The organization that provides and manages one or more term sources.
  """
  type Creator {
    uri: ID
    name: String!
    alternateName: String!
  }
  
  """
  A feature available for a source.
  """
  type Feature {
    type: FeatureType!
    url: ID
  }

  enum FeatureType {
    "Reconciliation Service API."
    RECONCILIATION

    "Genre-based filtering of search results."
    GENRE_FILTER
  }
  
  """
  A genre (category) that a source provides terms about.
  """
  type Genre {
    uri: ID!
    name: String!
  }
  
  """
  The latest known status of the terminology source.
  """
  type SourceStatus {
    isAvailable: Boolean!
    lastChecked: String!
  }

  """
  A description of a concept or entity, expressed in the SKOS vocabulary.
  """
  type Term {
    uri: ID!
    prefLabel: [String]!
    altLabel: [String]!
    hiddenLabel: [String]!
    definition: [String]!
    "For the full definition of the term, use \`definition\` instead of \`scopeNote\`. The contents of \`scopeNote\` may change later."
    scopeNote: [String]!
    seeAlso: [String]!
    broader: [RelatedTerm]
    narrower: [RelatedTerm]
    related: [RelatedTerm]
    exactMatch: [RelatedTerm]

    "The place that this term denotes, if its source describes one. Null when the source describes no place, whether because the term denotes something else or because the source gives no details about the place."
    place: Place

    "The person that this term denotes, if its source describes one. Null when the source describes no person, whether because the term denotes something else or because the source gives no details about the person."
    person: Person
  }

  type RelatedTerm {
    uri: ID!
    prefLabel: [String]!
  }
  
  enum Language {
    ${languages.join(' ')}
  }

  type Query {
    "Query one or more sources for terms."
    terms(
      "List of URIs of sources to query."
      sources: [ID]!,

      "Optional list of genres to filter results within sources that support genre-based filtering."
      genres: [ID],

      "A literal search query, for example \`Rembrandt\`."
      query: String!,

      "The mode in which the literal search query (\`query\`) is interpreted before it is sent to the term sources."      
      queryMode: QueryMode = OPTIMIZED,
      
      "List of languages in which to return terms, in preferred order. If one or more languages are specified, terms are returned as \`TranslatedTerm\`s. The available languages depend on what each source provides (see \`Source.inLanguage\`). Terms are never excluded from the result: if a term has no labels in the requested languages, labels tagged ‘mul’ (default for all languages) are returned in the first requested language, untagged literals are returned as Dutch (\`nl\`), and otherwise the label field is empty."
      languages: [Language],
      
      "Maximum number of terms to return."
      limit: Int = 100,

      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [TermsQueryResult]
    
    "List all sources that can be queried for terms."
    sources(
      "List of genre URIs to filter sources by."
      genres: [ID]
    ): [Source]
    
    "Look up terms by their URI."
    lookup(
      "List of term URIs."
      uris: [ID]!,
      
      "List of languages in which to return the term, in preferred order. If one or more languages are specified, any term found is returned as a \`TranslatedTerm\`. The available languages depend on what each source provides (see \`Source.inLanguage\`). Terms are never excluded from the result: if a term has no labels in the requested languages, labels tagged ‘mul’ (default for all languages) are returned in the first requested language, untagged literals are returned as Dutch (\`nl\`), and otherwise the label field is empty."
      languages: [Language],
      
      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [LookupQueryResult]
  }
  
  """
  The mode in which the literal search query (\`query\`) is interpreted before it is sent to the term sources.
  """
  enum QueryMode {
    "Optimize search query input for term sources. The default."
    OPTIMIZED
    
    "Send the unaltered query input to the term sources. For advanced users that want to have full control over the search query."
    RAW
  }

  type TermsQueryResult {
    "The term source that provides the terms."
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: TermsResult!
    
    "Response time in milliseconds."
    responseTimeMs: Int!
  }

  union TermsResult = Terms | TranslatedTerms | TimeoutError | ServerError

  type Terms {
    terms: [Term]
  }
  
  type TranslatedTerms {
    terms: [TranslatedTerm]
  }
  
  """
  A description of a concept or entity, expressed in the SKOS vocabulary, with labels in the requested languages.
  """
  type TranslatedTerm {
    uri: ID!
    prefLabel: [LanguageString]!
    altLabel: [LanguageString]!
    hiddenLabel: [LanguageString]!
    definition: [LanguageString]!
    scopeNote: [LanguageString]!
    seeAlso: [String]!
    broader: [TranslatedRelatedTerm]
    narrower: [TranslatedRelatedTerm]
    related: [TranslatedRelatedTerm]
    exactMatch: [TranslatedRelatedTerm]

    "The place that this term denotes, if its source describes one. Null when the source describes no place, whether because the term denotes something else or because the source gives no details about the place."
    place: Place

    "The person that this term denotes, if its source describes one. Null when the source describes no person, whether because the term denotes something else or because the source gives no details about the person."
    person: Person
  }

  """
  The place that a term denotes. It carries only what SKOS cannot state: the term’s position in the place hierarchy stays on \`broader\` and \`narrower\`.
  """
  type Place {
    "The place’s own name, in the requested languages. Unlike \`prefLabel\`, it is the name the source holds and nothing else, without any suffix a source appends to tell homonyms apart. It is language-tagged in the monolingual API too, because this node arrived after \`Term\`’s plain-string labels were frozen."
    name: [LanguageString]!

    "Latitude of the place, in the WGS 84 coordinate reference system."
    latitude: Float

    "Longitude of the place, in the WGS 84 coordinate reference system."
    longitude: Float

    "The country that the place is in, as an ISO 3166-1 alpha-2 code, for example \`NL\`. Where a source tells homonymous places apart by appending the country to \`prefLabel\`, this is that country as data."
    addressCountry: String

    "What kind of place this is, according to the source’s own vocabulary – a GeoNames feature code such as \`https://www.geonames.org/ontology#P.PPLA\`, for example. The vocabularies differ per source and the Network of Terms does not harmonise them, so a client either recognises the vocabulary or joins to it itself."
    additionalType: [AdditionalType]!
  }

  """
  A type from a vocabulary outside the Network of Terms, identified by its URI. \`name\` is empty unless the vocabulary is published with one, which most are not.
  """
  type AdditionalType {
    uri: ID!
    name: [LanguageString]!
  }

  """
  The person that a term denotes. It carries only what SKOS cannot state: the person’s names stay on \`prefLabel\` and \`altLabel\`, and their alignments to other sources on \`exactMatch\`.
  """
  type Person {
    "Date of birth, as an EDTF string (Extended Date/Time Format, the Library of Congress profile of ISO 8601-1 and 8601-2): a date at whatever precision the source knows (\`1606\`, \`1606-07\`, \`1606-07-15\`), an interval (\`1606-07-15/1607\`), or a qualified date (\`1620~\` for circa, \`1643?\` for uncertain, \`139X\` for a decade). Passed through as the source states it, so a source that publishes something else is returned verbatim; the Network of Terms does not validate it. Null when the source states none."
    birthDate: String

    "Date of death, in the same form as \`birthDate\`."
    deathDate: String

    "Where the person was born, in the source’s own vocabulary."
    birthPlace: [Reference]!

    "Where the person died, in the source’s own vocabulary."
    deathPlace: [Reference]!

    "What the person did, in the source’s own vocabulary."
    hasOccupation: [Reference]!

    "The person’s nationality, in the source’s own vocabulary."
    nationality: [Reference]!
  }

  """
  Something a source refers to, by URI, by name, or both. A source with a vocabulary of its own gives the URI and whatever names it publishes for it; a source that only knows a name gives that name and no URI, one reference per name, since nothing tells its names in two languages for one thing apart from its names for two things. The vocabularies differ per source and the Network of Terms does not harmonise them.
  """
  type Reference {
    uri: ID
    name: [LanguageString]!
  }
  
  type TranslatedRelatedTerm {
    uri: ID!
    prefLabel: [LanguageString]!
  }
  
  type LanguageString {
    language: Language!
    value: String!
  }

  type LookupQueryResult {
    "The term’s URI."
    uri: ID!

    "The term source that provides the term or an error if no source could be found."
    source: SourceResult!

    "The term if the lookup succeeded; an error otherwise."
    result: LookupResult!
    
    "Response time in milliseconds."
    responseTimeMs: Int!
  }

  union SourceResult = Source | SourceNotFoundError

  union LookupResult = Term | TranslatedTerm | NotFoundError | TimeoutError | ServerError

  """
  The term source failed to respond within the timeout period.
  """
  type TimeoutError implements Error {
    message: String!
  }

  """
  The term source responded with an error.
  """
  type ServerError implements Error {
    message: String!
  }

  """
  No source could be found that can provide the term.
  """
  type SourceNotFoundError implements Error {
    message: String!
  }

  """
  The term could not be found.
  """
  type NotFoundError implements Error {
    message: String!
  }

  interface Error {
    message: String!
  }
`;
