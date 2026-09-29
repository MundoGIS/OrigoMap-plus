// Usage: node scripts/reset-password.js <username> [--create] [--role admin|intern|extern]
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt');

const usersFilePath = path.join(__dirname, '..', 'auth', 'users.json');
const roles = ['admin', 'intern', 'extern'];
const minLength = 12;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { username: null, create: false, role: 'admin' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') continue;
    if (argv[i] === '--create') args.create = true;
    else if (argv[i] === '--role') args.role = argv[++i];
    else if (!args.username) args.username = argv[i];
    else fail(`Unknown argument: ${argv[i]}`);
  }
  if (!args.username) fail('Usage: node scripts/reset-password.js <username> [--create] [--role admin|intern|extern]');
  if (!roles.includes(args.role)) fail(`Role must be one of: ${roles.join(', ')}`);
  return args;
}

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = text => {
      if (text.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, answer => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function readUsers() {
  if (!fs.existsSync(usersFilePath)) return [];
  const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
  if (!Array.isArray(users)) fail(`${usersFilePath} must contain a JSON array.`);
  return users;
}

function writeUsers(users) {
  fs.mkdirSync(path.dirname(usersFilePath), { recursive: true });
  const tempPath = `${usersFilePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(users, null, 2));
  fs.renameSync(tempPath, usersFilePath);
}

async function main() {
  const { username, create, role } = parseArgs(process.argv.slice(2));
  const users = readUsers();
  let user = users.find(u => u.username === username);

  if (!user && !create) fail(`User '${username}' not found. Use --create to add it.`);
  if (!process.stdin.isTTY) fail('Run this script in an interactive terminal.');

  const password = await askHidden(`New password for '${username}' (min ${minLength} chars): `);
  if (password.length < minLength) fail(`Password must be at least ${minLength} characters.`);
  const confirmation = await askHidden('Repeat password: ');
  if (password !== confirmation) fail('Passwords do not match.');

  const hash = await bcrypt.hash(password, 14);
  if (user) {
    user.password = hash;
  } else {
    user = { username, password: hash, role, allowedMaps: [] };
    users.push(user);
  }
  writeUsers(users);

  console.log(`Password set for '${username}' (role: ${user.role}). Existing sessions for this user are now invalid.`);
}

main().catch(error => fail(`Error: ${error.message}`));
