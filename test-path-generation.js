import { generatePathFromTitle } from './dist/utils/pathGeneration/index.js';

const testCases = [
  // Known technologies
  {
    title: "How to find an element in Redis",
    tags: ["redis", "database", "search"]
  },
  {
    title: "JWT authentication best practices",
    tags: ["jwt", "auth", "security"]
  },
  {
    title: "Fix MongoDB connection timeout",
    tags: ["mongodb", "error", "timeout"]
  },
  
  // Unknown technologies with context
  {
    title: "How to configure Terraspace for AWS deployments",
    tags: ["terraspace", "aws", "iac", "deployment"]
  },
  {
    title: "Pulumi vs Terraform comparison",
    tags: ["pulumi", "terraform", "iac", "comparison"]
  },
  {
    title: "Setting up Spacelift CI/CD pipeline",
    tags: ["spacelift", "ci-cd", "automation"]
  },
  
  // Edge cases
  {
    title: "Understanding Quantum Computing basics",
    tags: ["quantum", "computing", "theory"]
  },
  {
    title: "React hooks tutorial with TypeScript",
    tags: ["react", "hooks", "typescript", "tutorial"]
  },
  {
    title: "Best practices for microservices architecture",
    tags: ["microservices", "architecture", "best-practices"]
  }
];

console.log("Path Generation Test Results\n");
console.log("=".repeat(80));

for (const testCase of testCases) {
  const path = generatePathFromTitle(testCase.title, { tags: testCase.tags });
  console.log(`\nTitle: "${testCase.title}"`);
  console.log(`Tags: [${testCase.tags.join(", ")}]`);
  console.log(`Generated Path: ${path}`);
}

console.log("\n" + "=".repeat(80));