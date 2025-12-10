import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTests() {
  console.log('🚀 Running All Tests...\n');

  const tests = [
    { name: 'Functionality Tests', cmd: 'npm run test:functionality' },
    { name: 'API Endpoint Tests', cmd: 'npm run test:api' }
  ];

  let allPassed = true;

  for (const { name, cmd } of tests) {
    console.log(`\n📋 Running ${name}...\n`);
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: process.cwd() });
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      console.error(`❌ ${name} failed:`);
      console.error(error.stdout || error.message);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n🎉 All test suites passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some test suites failed');
    process.exit(1);
  }
}

runTests();
