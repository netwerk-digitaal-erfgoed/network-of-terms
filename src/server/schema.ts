export const schema = `
  type Source {
    uri: ID!
    name: String!
    creators: [Creator]!
  }

  type Creator {
    uri: ID!
    identifier: String!
  }

  type Term {
    uri: ID!
    prefLabel: [String]!
    altLabel: [String]!
    hiddenLabel: [String]!
    scopeNote: [String]!
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
