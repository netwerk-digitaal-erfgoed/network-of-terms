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

  type TermsQueryResult {
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: TermsResult!
  }

  type Query {
    terms(sources: [ID]!, query: String!, timeoutMs: Int = 10000): [TermsQueryResult]
    sources: [Source]
  }
  
  union TermsResult = Terms | TimeoutError | ServerError
  
  type Terms {
    terms: [Term]
  }
  
  type TimeoutError implements Error {
    message: String!
  }
  
  type ServerError implements Error {
    message: String!
  }
  
  interface Error {
    message: String!
  }
`;
