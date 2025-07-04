import { task } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseEther } from 'ethers';

interface CreateTransfersArgs {
  token: string;
  recipient: string | undefined;
  amount: string;
  count: string;
}

task('create-transfers')
  .addParam('token', 'MiniMe token contract address')
  .addParam('recipient', 'Recipient address (optional, defaults to second signer)', '')
  .addParam('amount', 'Amount to transfer per transaction (in token units)', '100')
  .addParam('count', 'Number of transfer transactions to create', '5')
  .setAction(async (args: CreateTransfersArgs, hre) => {
    const [deployer, defaultRecipient] = await hre.ethers.getSigners();
    const recipient = args.recipient || defaultRecipient.address;
    
    const count = parseInt(args.count);
    console.log(`Creating ${count} transfer transactions for MiniMe token at ${args.token}`);
    console.log(`From: ${deployer.address}`);
    console.log(`To: ${recipient}`);
    console.log(`Amount per transfer: ${args.amount} tokens`);

    // Get the MiniMe token contract
    const contract = await hre.ethers.getContractAt('MiniMeToken', args.token);
    
    // Check initial balance
    const initialBalance = await contract.balanceOf(deployer.address);
    console.log(`Initial balance: ${initialBalance.toString()}`);
    
    const transferAmount = parseEther(args.amount);
    const totalTransferAmount = transferAmount * BigInt(count);
    
    if (initialBalance < totalTransferAmount) {
      throw new Error(`Insufficient balance. Need ${totalTransferAmount.toString()}, have ${initialBalance.toString()}`);
    }

    // Create transfer transactions to generate checkpoints
    const transactions = [];
    
    for (let i = 0; i < count; i++) {
      console.log(`\nCreating transfer ${i + 1}/${count}...`);
      
      const tx = await contract.transfer(recipient, transferAmount);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Block number: ${receipt?.blockNumber}`);
      
      // Check balances after transfer
      const senderBalance = await contract.balanceOf(deployer.address);
      const recipientBalance = await contract.balanceOf(recipient);
      
      console.log(`Sender balance: ${senderBalance.toString()}`);
      console.log(`Recipient balance: ${recipientBalance.toString()}`);
      
      transactions.push({
        hash: tx.hash,
        blockNumber: receipt?.blockNumber,
        amount: transferAmount.toString(),
        senderBalance: senderBalance.toString(),
        recipientBalance: recipientBalance.toString(),
      });
      
      // Wait a bit between transactions to ensure different blocks
      if (i < count - 1) {
        console.log('Waiting for next block...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n=== Transfer Summary ===');
    console.log(`Token: ${args.token}`);
    console.log(`Total transfers: ${count}`);
    console.log(`Total amount transferred: ${totalTransferAmount.toString()}`);
    console.log(`From: ${deployer.address}`);
    console.log(`To: ${recipient}`);
    
    console.log('\n=== Transaction Details ===');
    transactions.forEach((tx, i) => {
      console.log(`Transfer ${i + 1}:`);
      console.log(`  Hash: ${tx.hash}`);
      console.log(`  Block: ${tx.blockNumber}`);
      console.log(`  Amount: ${tx.amount}`);
      console.log(`  Sender Balance: ${tx.senderBalance}`);
      console.log(`  Recipient Balance: ${tx.recipientBalance}`);
    });

    // Display checkpoint information
    console.log('\n=== Checkpoint Analysis ===');
    const finalSenderBalance = await contract.balanceOfAt(deployer.address, await hre.ethers.provider.getBlockNumber());
    const finalRecipientBalance = await contract.balanceOfAt(recipient, await hre.ethers.provider.getBlockNumber());
    
    console.log(`Final sender balance: ${finalSenderBalance.toString()}`);
    console.log(`Final recipient balance: ${finalRecipientBalance.toString()}`);
    
    // Check historical balances at different blocks
    if (transactions.length > 0) {
      const firstBlock = transactions[0].blockNumber!;
      const lastBlock = transactions[transactions.length - 1].blockNumber!;
      
      const senderBalanceAtFirst = await contract.balanceOfAt(deployer.address, firstBlock);
      const recipientBalanceAtFirst = await contract.balanceOfAt(recipient, firstBlock);
      
      console.log(`\nHistorical balances at block ${firstBlock}:`);
      console.log(`  Sender: ${senderBalanceAtFirst.toString()}`);
      console.log(`  Recipient: ${recipientBalanceAtFirst.toString()}`);
      
      if (firstBlock !== lastBlock) {
        const senderBalanceAtLast = await contract.balanceOfAt(deployer.address, lastBlock);
        const recipientBalanceAtLast = await contract.balanceOfAt(recipient, lastBlock);
        
        console.log(`\nHistorical balances at block ${lastBlock}:`);
        console.log(`  Sender: ${senderBalanceAtLast.toString()}`);
        console.log(`  Recipient: ${recipientBalanceAtLast.toString()}`);
      }
    }
  });