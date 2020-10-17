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

  type Terms {
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: Result!
  }

  type Query {
    terms(sources: [ID]!, query: String!): [Terms]
    sources: [Source]
  }
  
  union Result = Success | TimeoutError | ServerError
  
  type Success {
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
