/**
 * File Service - Handles file system operations
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { IFileService } from '../types';

export class FileService implements IFileService {
    async readFile(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf-8');
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const data = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(uri, data);
    }

    async deleteFile(filePath: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.delete(uri);
    }

    async moveFile(sourcePath: string, targetPath: string): Promise<void> {
        const sourceUri = vscode.Uri.file(sourcePath);
        const targetUri = vscode.Uri.file(targetPath);
        await vscode.workspace.fs.rename(sourceUri, targetUri, { overwrite: false });
    }

    async createDirectory(dirPath: string): Promise<void> {
        const uri = vscode.Uri.file(dirPath);
        await vscode.workspace.fs.createDirectory(uri);
    }

    async listFiles(dirPath: string): Promise<string[]> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return entries
                .filter(entry => entry.isFile())
                .map(entry => entry.name);
        } catch (error) {
            throw new Error(`Failed to list files in ${dirPath}: ${error}`);
        }
    }

    async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stats = await fs.promises.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }
}
