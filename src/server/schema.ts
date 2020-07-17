export const schema = `
  type Source {
    identifier: ID!
    name: String!
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
