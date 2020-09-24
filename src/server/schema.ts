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
  }
  
  type RelatedTerm {
    uri: ID!
    prefLabel: [String]!
  }

  type Terms {
    source: Source!
    terms: [Term]!
  }

  type Query {
    terms(sources: [ID]!, query: String!): [Terms]
    sources: [Source]
  }
`;
