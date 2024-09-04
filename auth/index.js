const { startStandaloneServer } = require("@apollo/server/standalone");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwtHelper = require("../helper/jwtHelper");
const { ApolloServer } = require("@apollo/server");
const { buildSubgraphSchema } = require("@apollo/subgraph");
const { default: gql } = require("graphql-tag");

const Prisma = new PrismaClient();


const typeDefs = gql`
  type User @key(fields: "id") {
    id: ID!
    email: String!
    name: String!
    createdAt: String!
    updatedAt: String!
    profile: Profile
  }

  type Profile {
    id: ID!
    bio: String
    user: User
    createdAt: String!
  }

  type UserArgs {
    userError: String 
    token: String
  }

  extend type Query {
    profile(id: ID!): Profile
    users: [User!]!
    myProfile: User
  }

  extend type Mutation {
    createUser(email: String!, name: String!, password: String!, bio: String): UserArgs
    login(email: String!, password: String!): UserArgs
  }
`;

const resolvers = {
  Query: {
    async profile(_, args, context) {
      return Prisma.profile.findUnique({
        where: { id: parseInt(args.id) },
      });
    },
    async users(_, args, context) {
      return Prisma.user.findMany();
    },
    async myProfile(_, args, context) {
      const user = jwtHelper.verifyToken(context.token);
      return Prisma.user.findUnique({
        where: { id: user.id },
      });
    }
  },
  Mutation: {
    async createUser(_, args, context) {
      const isExist = await Prisma.user.findUnique({
        where: { email: args.email },
      });

      if (isExist) {
        return { userError: "User already exist", token: null };
      }

      const hashedPassword = await bcrypt.hash(args.password, 10);
      const newUser = await Prisma.user.create({
        data: {
          email: args.email,
          name: args.name,
          password: hashedPassword,
        },
      });

      if(args.bio) {
        await Prisma.profile.create({
          data: {
            bio: args.bio,
            userId: newUser.id,
          },
        });
      }

      const token = jwtHelper.generateToken({id: newUser.id})

      return { userError: null, token };
    },
    async login(_, args, context) {
      
      const user = await Prisma.user.findUnique({
        where: { email: args.email },
      });

      if (!user) {
        return { userError: "User not found", token: null };
      }

      const isPasswordMatch = await bcrypt.compare(args.password, user.password);

      if (!isPasswordMatch) {
        return { userError: "Password is incorrect", token: null };
      }

      const token = jwtHelper.generateToken({id: user.id})

      return { userError: null, token };
    }
  },
  User: {
    __resolveReference(user) {
      return Prisma.user.findUnique({
        where: { id: parseInt(user.id) },
      });
    },
    profile(user) {
      return Prisma.profile.findUnique({
        where: { userId: user.id },
      });
    }
  }  
};

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  // plugins: [ApolloServerPluginInlineTrace()],
});

const main = async () => {
  try {
    const { url } = await startStandaloneServer(server, {
      listen: { port: 4001 },
      context: ({ req }) => {
        const token = req.headers.authorization || "";
        return { token };
      },
    });
    console.log(`🚀 Auth Server ready at: ${url}`);
  } catch (error) {
    console.error("Error starting server:", error);
  }
};

main();


