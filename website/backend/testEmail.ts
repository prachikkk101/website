import { validateEmailStrict } from './src/utils/emailValidator';

async function test() {
  try {
    console.log('Testing email...');
    const result = await validateEmailStrict('khandelwalprachi63@gmail.com');
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
