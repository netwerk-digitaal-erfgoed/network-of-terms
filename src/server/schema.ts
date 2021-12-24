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
    seeAlso: [String]!
    broader: [RelatedTerm]
    narrower: [RelatedTerm]
    related: [RelatedTerm]
  }

  type RelatedTerm {
    uri: ID!
    prefLabel: [String]!
  }

  type Query {
    "Query one or more sources for terms."
    terms(
      "List of URIs of sources to query."
      sources: [ID]!,
      
      "A literal search query, for example \`Rembrandt\`."
      query: String!,

      "The mode in which the literal search query (\`query\`) is interpreted before it is sent to the term sources."      
      queryMode: QueryMode = DEPRECATED

      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [TermsQueryResult]
    
    "List all sources that can be queried for terms."
    sources: [Source]
    
    "Look up terms by their URI."
    lookup(
      "List of term URIs."
      uris: [ID]!,
      
      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [LookupQueryResult]
  }
  
  """
  The mode in which the literal search query (\`query\`) is interpreted before it is sent to the term sources.
  """
  enum QueryMode {
    "This mode is only for backwards-compatibility. Switch to \`OPTIMIZED\` mode for forwards-compatibility."
    DEPRECATED @deprecated(reason: "This mode will be removed in the future. Use \`OPTIMIZED\` instead.")
    
    "Optimize search query input for term sources. This will become the default."
    OPTIMIZED
    
    "Send the unaltered query input to the term sources. For advanced users that want to have full control over the search query."
    RAW
  }

  type TermsQueryResult {
    "The term source that provides the terms."
    source: Source!
    terms: [Term]! @deprecated(reason: "Use 'result' instead")
    result: TermsResult!
  }

  union TermsResult = Terms | TimeoutError | ServerError

  type Terms {
    terms: [Term]
  }

  type LookupQueryResult {
    "The term’s URI."
    uri: ID!

    "The term source that provides the term or an error if no source could be found."
    source: SourceResult!

    "The term if the lookup succeeded; an error otherwise."
    result: LookupResult!
  }

  union SourceResult = Source | SourceNotFoundError

  union LookupResult = Term | NotFoundError | TimeoutError | ServerError

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
