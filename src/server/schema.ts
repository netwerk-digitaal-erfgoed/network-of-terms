export const schema = `
  """
  A term source is a collection of terms.
  """
  type Source {
    uri: ID!
    name: String!
    alternateName: String
    creators: [Creator]!
  }

  """
  The organization that provides and manages one or more term sources.
  """
  type Creator {
    uri: ID!
    name: String!
    alternateName: String!
  }

  """
  A description of a concept or entity, expressed in the SKOS vocabulary, used to describe objects.
  """
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
    "The term source that provides the terms."
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: TermsResult!
  }

  type Query {
    "Query one or more sources for terms."
    terms(
      "List of URIs of sources to query."
      sources: [ID]!,
      
      "A literal search query, for example \`Rembrandt\`."
      query: String!,

      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [TermsQueryResult]
    
    "List all sources that can be queried for terms."
    sources: [Source]
  }
  
  union TermsResult = Terms | TimeoutError | ServerError
  
  type Terms {
    terms: [Term]
  }
  
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
  
  interface Error {
    message: String!
  }
`;
