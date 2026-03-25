/**
 * File Service - Handles file system operations
 */

import * as vscode from 'vscode';

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
            const uri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries
                .filter(([, type]) => type === vscode.FileType.File)
                .map(([name]) => name);
        } catch (error) {
            throw new Error(`Failed to list files in ${dirPath}: ${error}`);
        }
    }

    async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }

    async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(dirPath));
            return (stat.type & vscode.FileType.Directory) !== 0;
        } catch {
            return false;
        }
    }
}
