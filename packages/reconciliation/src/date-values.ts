import { Literal } from '@rdfjs/types';

// Sources are not validated, so a date may be an empty string; that is no date.
export const dateValues = (dates: Literal[]) =>
  dates.map((date) => date.value.trim()).filter((date) => date !== '');
