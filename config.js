// Configuration file for the auth template
module.exports = {
    description: 'Authentication template with JWT and session options',
    
    // Get configuration from user through prompts
    getPrompts: async () => {
      const inquirer = require('inquirer');
      
      return inquirer.prompt([
        {
          type: 'list',
          name: 'authType',
          message: 'Select authentication type:',
          choices: ['JWT', 'Session', 'Both'],
          default: 'JWT'
        },
        {
          type: 'confirm',
          name: 'useGoogle',
          message: 'Include Google authentication?',
          default: false
        },
        {
          type: 'input',
          name: 'jwtSecret',
          message: 'Enter JWT secret (or leave empty to generate one):',
          default: '',
          when: (answers) => answers.authType !== 'Session'
        },
        {
          type: 'input',
          name: 'jwtExpiry',
          message: 'JWT expiry time:',
          default: '7d',
          when: (answers) => answers.authType !== 'Session'
        }
      ]);
    },
    
    // Next steps to show after installation
    nextSteps: [
      'Configure your .env file with JWT_SECRET',
      'Setup your database with Prisma',
      'Import the AuthProvider in your main App component',
      'Use ProtectedRoute for private routes'
    ]
  };