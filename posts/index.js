const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const jwtHelper = require("../helper/jwtHelper");
const { PrismaClient } = require("@prisma/client");
const { default: gql } = require("graphql-tag");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const {
  ApolloServerPluginInlineTrace,
} = require("@apollo/server/plugin/inlineTrace");

const Prisma = new PrismaClient();

const typeDefs = gql`
  type Post @key(fields: "id") {
    id: ID!
    title: String!
    content: String!
    published: Boolean!
    authorId: Int!
    createdAt: String!
  }

  type PostResponse {
    userError: String
    post: Post
  }

  input PostInput {
    title: String
    content: String
  }

  extend type Query {
    posts: [Post!]!
  }

  extend type Mutation {
    createPost(title: String!, content: String!): PostResponse
    updatePost(postId: ID!, post: PostInput!): PostResponse
    deletePost(postId: ID!): PostResponse
    publishPost(postId: ID!): PostResponse
  }
`;

const resolvers = {
  Query: {
    posts: async () => {
      return await Prisma.post.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    },
  },
  Mutation: {
    createPost: async (_, args, context) => {
      const { title, content } = args;
      const token = context.token;
      console.log(token);
      const user = jwtHelper.verifyToken(token);
      if (!user) {
        return {
          userError: "Invalid token",
          post: null,
        };
      }
      if (!title || !content) {
        return {
          userError: "Title and content are required",
          post: null,
        };
      }
      const newPost = await Prisma.post.create({
        data: {
          title,
          content,
          authorId: user.id,
          published: false,
        },
      });
      return {
        post: newPost,
        userError: null,
      };
    },
  },
  Post: {
    __resolveReference: async (post) => {
      return await Prisma.post.findUnique({
        where: { id: post.id },
      });
    },
  },
};

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  plugins: [ApolloServerPluginInlineTrace()],
});

const main = async () => {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4002 },
    context: ({ req }) => {
      // console.log(req.headers);
      const token = req.headers.authorization || "";
      return {
        token,
      };
    },
  });

  console.log(`🚀 posts Server ready at: ${url}`);
};

main();
