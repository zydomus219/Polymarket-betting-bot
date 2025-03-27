import readline from 'readline';
import connectDB from './config/db';
import createClobClient from './utils/createClobClient';
import { ClobClient } from '@polymarket/clob-client';
import ora from 'ora';
import test from './test/test';
import TradeMonitor from './services/tradeMonitor';
import tradeExecutor from './services/tradeExecutor';
import { TradeParams } from './interfaces/tradeInterfaces';

const promptUser = async (): Promise<TradeParams> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log(
        'hey, I’m going to go into monitor mode for a few days, what parameters should I use the whole time I’m running?'
    );

    const question = (query: string): Promise<string> =>
        new Promise((resolve) => rl.question(query, resolve));

    const targetWallet = await question('Enter target wallet address: ');
    const copyRatio = parseInt(
        await question('Enter your wanted ratio (fraction): '),
        10
    );

    const retryLimit = parseInt(await question('Enter retry limit: '), 10);

    const initialOrderTimeout = parseInt(
        await question('Enter initial order timeout (in seconds): '),
        10
    );
    const secondOrderIncrement = parseInt(
        await question('Enter second order increment (in cents): '),
        10
    );
    const secondOrderTimeout = parseInt(
        await question('Enter second order timeout (in seconds): '),
        10
    );
    const finalOrderIncrement = parseInt(
        await question('Enter final order increment (in cents): '),
        10
    );
    const finalOrderTimeout = parseInt(
        await question('Enter final order timeout (in seconds): '),
        10
    );

    rl.close();

    return {
        targetWallet,
        copyRatio,
        retryLimit,
        initialOrderTimeout,
        secondOrderIncrement,
        secondOrderTimeout,
        finalOrderIncrement,
        finalOrderTimeout,
    };
};

export const main = async () => {
    // await test();
    const connectDBSpinner = ora('Connecting DB...').start();
    await connectDB();
    connectDBSpinner.succeed('Connected to MongoDB.\n');
    const createClobClientSpinner = ora('Creating ClobClient...').start();
    const clobClient = await createClobClient();
    createClobClientSpinner.succeed('ClobClient created\n');
    const params = await promptUser();
    // console.log(params);
    // const params = {
    //     targetWallet: '0xd218e474776403a330142299f7796e8ba32eb5c9',
    //     retryLimit: 1,
    //     initialOrderTimeout: 10,
    //     secondOrderIncrement: 1,
    //     secondOrderTimeout: 10,
    //     finalOrderIncrement: 1,
    //     finalOrderTimeout: 10,
    // };
    const botStartSpinner = ora('Starting the bot...').start();
    const monitor = new TradeMonitor();
    monitor.on('transaction', (data) => {
        tradeExecutor(clobClient, data, params);
    });
    monitor.start(params.targetWallet);
    botStartSpinner.succeed('Bot started\n');
};

main();
