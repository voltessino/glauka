    /* Open Source edition: AI cloud/BYOK providers belong to Glauka Pro. */
    class UniversalAIClient {
      constructor() { this.settings = {}; this.apiKey = ''; }
      configure() {}
      protocol() { return 'open'; }
      endpoint() { throw Error('AI features are part of Glauka Pro (https://glauka.it).'); }
      modelName() { return ''; }
      async request() { throw Error('AI features are part of Glauka Pro (https://glauka.it).'); }
      cancel() {}
    }
