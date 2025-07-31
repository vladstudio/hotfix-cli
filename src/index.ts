#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as readline from "node:readline";

class HotfixCLI {
	private branchName: string = "";
	private originalBranch: string = "";
	private commitMessage: string = "";

	async run(): Promise<void> {
		try {
			console.log("🚀 Starting automated hotfix workflow...");

			await this.validateEnvironment();
			await this.generateCommitMessage();
			await this.generateBranchName();
			await this.createAndSwitchBranch();
			await this.commitChanges();
			await this.pushBranch();
			await this.createPR();
			await this.mergePR();
			await this.cleanup();

			console.log("✅ Hotfix workflow completed successfully!");
		} catch (error) {
			console.error(
				"❌ Hotfix workflow failed:",
				error instanceof Error ? error.message : error,
			);
			await this.rollback();
			process.exit(1);
		}
	}

	private async validateEnvironment(): Promise<void> {
		console.log("🔍 Validating environment...");

		// Check if we're in a git repository
		try {
			this.executeCommand("git rev-parse --git-dir");
		} catch {
			throw new Error("Not in a git repository");
		}

		// Check if gh CLI is available and authenticated
		try {
			this.executeCommand("gh auth status");
		} catch {
			throw new Error("GitHub CLI not authenticated. Run: gh auth login");
		}

		// Get current branch
		this.originalBranch = this.executeCommand(
			"git branch --show-current",
		).trim();

		// Check if we're on main branch
		if (this.originalBranch !== "main") {
			throw new Error(
				`Must be on main branch. Currently on: ${this.originalBranch}`,
			);
		}

		// Check if there are changes to commit
		const status = this.executeCommand("git status --porcelain").trim();
		if (!status) {
			throw new Error("No changes to commit");
		}

		console.log("✅ Environment validation passed");
	}

	private async generateCommitMessage(): Promise<void> {
		console.log("📝 Generating commit message...");

		try {
			this.commitMessage = this.executeCommand("commitologist").trim();
			if (!this.commitMessage) {
				throw new Error("Empty commit message from commitologist");
			}
			console.log("✅ Generated smart commit message from commitologist");
		} catch {
			const timestamp = new Date().toLocaleString();
			this.commitMessage = `Hotfix: automated fix (${timestamp})`;
			console.log("✅ Using fallback commit message");
		}

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		try {
			const editedMessage = await new Promise<string>((resolve) => {
				rl.question(`📝 Commit message: ${this.commitMessage}\n✏️ Edit if needed (or press Enter to continue): `, (answer) => {
					resolve(answer.trim() || this.commitMessage);
				});
			});
			this.commitMessage = editedMessage;
			console.log(`✅ Final commit message: "${this.commitMessage}"`);
		} finally {
			rl.close();
		}
	}

	private async generateBranchName(): Promise<void> {
		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", "-")
			.substring(0, 19);

		this.branchName = `hotfix-${timestamp}`;
		console.log(`📝 Generated branch name: ${this.branchName}`);
	}

	private async createAndSwitchBranch(): Promise<void> {
		console.log(`🌿 Creating and switching to branch: ${this.branchName}`);
		this.executeCommand(`git checkout -b ${this.branchName}`);
	}

	private async commitChanges(): Promise<void> {
		console.log("📦 Staging and committing changes...");

		this.executeCommand("git add .");
		this.executeCommand(`git commit -m "${this.commitMessage}"`);
		console.log(`✅ Changes committed`);
	}

	private async pushBranch(): Promise<void> {
		console.log(`⬆️ Pushing branch to origin...`);
		this.executeCommand(`git push origin ${this.branchName}`);
	}

	private async createPR(): Promise<void> {
		console.log("🔄 Creating pull request...");

		const title = this.commitMessage.length > 70 ? this.commitMessage.substring(0, 70) : this.commitMessage;
		const body = `Automated hotfix created at ${new Date().toLocaleString()}`;

		this.executeCommand(
			`gh pr create --title "${title}" --body "${body}" --base main --head ${this.branchName}`,
		);
		console.log("✅ Pull request created");
	}

	private async mergePR(): Promise<void> {
		console.log("🔀 Merging pull request...");

		// Wait a moment for PR to be fully created
		await this.sleep(1000);

		try {
			// Try automatic merge first
			this.executeCommand(
				`gh pr merge ${this.branchName} --merge --delete-branch --auto`,
			);
			console.log("✅ Pull request merged and remote branch deleted");
		} catch {
			console.log("⚠️ Automatic merge failed. Opening pull request for manual merge...");
			
			// Open the PR in browser
			this.executeCommand(`gh pr view ${this.branchName} --web`);
			
			// Wait for user input
			console.log("📝 Please merge the pull request manually in your browser.");
			console.log("⌨️ Press Enter after you have merged the pull request to continue...");
			
			// Wait for user to press Enter
			await this.waitForUserInput();
			
			console.log("✅ Manual merge completed, continuing with cleanup...");
		}
	}

	private async cleanup(): Promise<void> {
		console.log("🧹 Cleaning up...");

		// Switch back to main
		this.executeCommand("git checkout main");

		// Pull latest changes
		this.executeCommand("git pull origin main");

		// Delete local branch if it exists
		try {
			this.executeCommand(`git branch -D ${this.branchName}`);
			console.log(`✅ Local branch ${this.branchName} deleted`);
		} catch {
			console.log(`ℹ️ Local branch ${this.branchName} already deleted or not found`);
		}

		console.log("✅ Cleanup completed");
	}

	private async rollback(): Promise<void> {
		console.log("🔄 Rolling back changes...");

		try {
			// Try to switch back to original branch
			if (this.originalBranch) {
				this.executeCommand(`git checkout ${this.originalBranch}`);
			}

			// Delete local branch if it was created
			if (this.branchName) {
				try {
					this.executeCommand(`git branch -D ${this.branchName}`);
				} catch {
					// Branch might not exist, ignore
				}
			}

			console.log("✅ Rollback completed");
		} catch (error) {
			console.error(
				"⚠️ Rollback failed:",
				error instanceof Error ? error.message : error,
			);
		}
	}

	private executeCommand(command: string): string {
		try {
			return execSync(command, {
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Command failed: ${command}\n${message}`);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private waitForUserInput(): Promise<void> {
		return new Promise((resolve) => {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			rl.question("", () => {
				rl.close();
				resolve();
			});
		});
	}
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
	console.log('hotfix - Automated hotfix workflow for GitHub');
	console.log('Creates branch, commits changes, creates PR, and merges automatically');
	process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
	try {
		const packagePath = join(dirname(__filename), '..', 'package.json');
		const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
		console.log(packageJson.version);
	} catch {
		console.log('1.0.3');
	}
	process.exit(0);
}

// Main execution
const cli = new HotfixCLI();
cli.run();
