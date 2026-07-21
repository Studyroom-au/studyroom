import { defineConfig } from "vitest/config";
import path from "path";

// Separate config for the small number of tests that need a real Firestore
// emulator (rules tests + the one applySessionAction integration test).
// Keeps these out of the default `npm test` run, which needs no emulator and
// no dummy credentials at all.
const DUMMY_PRIVATE_KEY =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAwascm5XiyUoqRzcMth59c0MAMXw//pIOAktbfSG9bczmS0mY\nwwYLLlyAETMI34iirHQrQKz/BBJ3NhXalWSPlR0E1BsHjVfuv1TpOl/F2diTHKLB\nADZNYp+wLBs9Laer2pEtI/mgygcwz/lPs/OfLssU80yY7rLnvUZXyK9/aDow0LSl\n4oveRQdL2fBhN2wvXr1cAg9f59Avz0JSXbIliVfeZnLk8rqt98y4y5x0RpUqf6hD\naqt6KMg696yn6AQaQ7webU9VY58Ang3C6ssGO9gpDCPXpyggzXdVNPmgC0Gs+8z8\ndsTaC4MivJStcwT1DAVoYskJXB7CD7L08C9zaQIDAQABAoIBAAPWKj11ozifhssi\nnsE4Wn3x2A4C6Gh4V6f0ECJ1rHFMMkyP7zi/f3GfjOdvp6zi9xhcFEkbluaLdZpd\nZYyZAYRVFEszOQueeskGS05YBvJn+TvDiHfYO4v5E8tp44+VGeEnyAQa42nWfuEY\nhFD8AhLSRy6DMtKOuisccBaBDdt1u9JLJVFMJnXmLxibJ3pn3YhJiHY7h1sEvMb3\nDtf+p5iVxgSw1uH4BRSEAu+gYdwtxee7dGJJAbRoDTLZBBVqrKIQs2nLc4A1Vb76\nq+N1vdTxNESkaySnK4xhTI8Fk6+ukxEbMe9cVd1wDcCa4MUSEpTRymSELbo4IJqw\nRQUT8qECgYEA6Do96Ryx+dkVmqgADzY7weUiYJO3xd2NJXR5uUcCN3CemAwGYqr5\nuig/QHIXBfJshoy1RTiF92Auss9KUhrWWGh/xfvuchTGB12M1MBlFCpprmQhSmzd\n5Q0MouUDHD6hlr1QiSv4Z6qfknJ13scMeqJu+x6F5jUga5PFO5dqVEkCgYEA1X5j\nr/m1TAXfs0HxfKARFGR8XJCYo1bj0SxF2sft//n4/ECrm/GOFg5SFjMfeVesbpPL\nm4hpIULiYusbyDi1CgCibr3lPMwZThwdel5+kZXKjfpBciAs7bcQdOiz/699U1fY\nqn4BI+uIQWTBXAMhrxbvnj86cBkhBwPP4CO55iECgYAZEtDEbpi4xTuT6ze2bMCe\n+sJvcwOQlY870AukeYo/uiUlfYbi+FrmQpoxtx/NQJN/I4oe4y9zuirQm5kGrGcg\nPIgvNDhWkO+gs/UUs4E2YC3w6la91mtO483NeLSRRCHmSKJ9bQXxC3cXNMyNNSif\nxRH+gxkp9ep+MwJEoOCWIQKBgQDB+ItqH15xLAULQSa/LE9YT9QN5fJItXFXYvo0\nxOGgaOWnirpgfR+zOl+qe9hkzxuDfBTJwy6BYdt+NE6Ro7QY2mq6Yx4cFvQG29SM\nkb49V/Mo++7qWgF4GZOCJMsly7P6PR5GCSXQFPc/MuPbTZ0VD6m2BYx6vNodHYGJ\nC+yjAQKBgQC3KATlKizZO6OUckCgBn5kCUHOgFZ1TLAAMxdyQBB/qsotCc0UVE8Q\n25L/KNuSwwRJKMHVC9BYB4D1ojw5vEXnU3uUxymQiJkk51n+abp1b/Ax4ldVSyuO\neCscO4o7b++d/Zj/ke0Ha4+XOkv8zMG8CFBhiZx8bznzaC/LcBTUwg==\n-----END RSA PRIVATE KEY-----\n";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // These test files share one live Firestore emulator instance and each
    // clears/reseeds top-level collections in beforeEach — running them in
    // parallel workers causes one file's clear() to race the other file's
    // seed(). Force sequential execution across files.
    fileParallelism: false,
    include: [
      "src/lib/scheduling/__tests__/firestore.rules.test.ts",
      "src/lib/studyroom/__tests__/*.emulator.test.ts",
    ],
    env: {
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_PROJECT_ID: "demo-studyroom-rules-test",
      FIREBASE_CLIENT_EMAIL: "test@demo-studyroom-rules-test.iam.gserviceaccount.com",
      // Emulator-only dummy credential — never a real key, never used against
      // production. The Firestore emulator does not validate credentials, so
      // this only needs to be syntactically valid PEM.
      FIREBASE_PRIVATE_KEY: DUMMY_PRIVATE_KEY,
    },
  },
});
