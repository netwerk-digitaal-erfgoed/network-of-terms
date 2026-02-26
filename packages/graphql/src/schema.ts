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
    url: ID!
  }
  
  enum FeatureType {
    "Reconciliation Service API"
    RECONCILIATION
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
      
      "A literal search query, for example \`Rembrandt\`."
      query: String!,

      "The mode in which the literal search query (\`query\`) is interpreted before it is sent to the term sources."      
      queryMode: QueryMode = OPTIMIZED,
      
      "List of languages in which to return terms. If one or more languages are specified, terms are returned as \`TranslatedTerm\`s."
      languages: [Language],
      
      "Maximum number of terms to return."
      limit: Int = 100,

      "Timeout period in milliseconds that we wait for sources to respond."
      timeoutMs: Int = 10000
    ): [TermsQueryResult]
    
    "List all sources that can be queried for terms."
    sources: [Source]
    
    "Look up terms by their URI."
    lookup(
      "List of term URIs."
      uris: [ID]!,
      
      "List of languages in which to return the term. If one or more languages are specified, any term found is returned as a \`TranslatedTerm\`."
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
