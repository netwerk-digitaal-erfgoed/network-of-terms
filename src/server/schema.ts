export const schema = `
  type Source {
    uri: ID!
    name: String!
    alternateName: String
    creators: [Creator]!
  }

  type Creator {
    uri: ID!
    name: String!
    alternateName: String!
  }

  type Term {
    uri: ID!
    prefLabel: [String]!
    altLabel: [String]!
    hiddenLabel: [String]!
    scopeNote: [String]!
    broader: [RelatedTerm]
    narrower: [RelatedTerm]
    related: [RelatedTerm]
  }

  type RelatedTerm {
    uri: ID!
    prefLabel: [String]!
  }

  type Query {
    terms(sources: [ID]!, query: String!, timeoutMs: Int = 10000): [TermsQueryResult]
    sources: [Source]
    lookup(uris: [ID]!, timeoutMs: Int = 10000): [LookupResult]
  }

  type TermsQueryResult {
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: TermsResult!
  }

  union TermsResult = Terms | TimeoutError | ServerError

  type Terms {
    terms: [Term]
  }

  type LookupResult {
    uri: ID!
    source: Source
    result: LookupSuccessErrorResult
  }

  union LookupSuccessErrorResult = Term | TimeoutError | ServerError | SourceNotFoundError 

  type TimeoutError implements Error {
    message: String!
  }

  type ServerError implements Error {
    message: String!
  }

  type SourceNotFoundError implements Error {
    message: String!
  }

  interface Error {
    message: String!
  }
`;
