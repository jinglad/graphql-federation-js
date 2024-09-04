const { ApolloGateway, RemoteGraphQLDataSource } = require("@apollo/gateway");
const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");

class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }) {
    // Pass the user's token from the context to the subgraph
    request.http.headers.set('authorization', context.token || '');
  }
}


const gateway = new ApolloGateway({
  serviceList: [
    { name: 'auth', url: 'http://localhost:4001' },
    { name: 'posts', url: 'http://localhost:4002' },
  ],
  buildService({ name, url }) {
    return new AuthenticatedDataSource({ url });
  },
});


const server = new ApolloServer({
  gateway,
  subscriptions: false, 
  context: ({ req }) => {
    const token = req.headers.authorization || '';
    return { token };
  },
});


const main = async () => {
  try {
    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
    });
    console.log(`🚀 Gateway Server ready at ${url}`);
  } catch (error) {
    console.error('Error starting server:', error);
  }
};

main();