#!/usr/bin/env node

import { execSync } from "child_process";

class HotfixCLI {
	private branchName: string = "";
	private originalBranch: string = "";

	async run(): Promise<void> {
		try {
			console.log("🚀 Starting automated hotfix workflow...");

			await this.validateEnvironment();
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

		// Stage all changes
		this.executeCommand("git add .");

		// Generate commit message
		let commitMessage: string;
		try {
			// Try to use commitologist for smart commit message
			commitMessage = this.executeCommand("commitologist").trim();
			if (!commitMessage) {
				throw new Error("Empty commit message from commitologist");
			}
			console.log("📝 Using smart commit message from commitologist");
		} catch {
			// Fall back to default message if commitologist fails or is not available
			const timestamp = new Date().toLocaleString();
			commitMessage = `Hotfix: automated fix (${timestamp})`;
			console.log("📝 Using fallback commit message");
		}

		// Commit changes
		this.executeCommand(`git commit -m "${commitMessage}"`);
		console.log(`✅ Changes committed with message: "${commitMessage}"`);
	}

	private async pushBranch(): Promise<void> {
		console.log(`⬆️ Pushing branch to origin...`);
		this.executeCommand(`git push origin ${this.branchName}`);
	}

	private async createPR(): Promise<void> {
		console.log("🔄 Creating pull request...");

		const title = `Hotfix: ${new Date().toLocaleDateString()}`;
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

		// Merge and delete remote branch
		this.executeCommand(
			`gh pr merge ${this.branchName} --merge --delete-branch --auto`,
		);
		console.log("✅ Pull request merged and remote branch deleted");
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
		} catch (error) {
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
		} catch (error: any) {
			throw new Error(`Command failed: ${command}\n${error.message}`);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Main execution
const cli = new HotfixCLI();
cli.run();
