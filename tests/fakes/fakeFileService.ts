import * as path from 'path';
import type { IFileService } from '../../ext/types';

export class FakeFileService implements IFileService {
    private files = new Map<string, string>();
    private directories = new Set<string>();

    addFile(filePath: string, content: string): void {
        this.files.set(filePath, content);
        this.directories.add(path.dirname(filePath));
    }

    addDirectory(dirPath: string): void {
        this.directories.add(dirPath);
    }

    async readFile(filePath: string): Promise<string> {
        const content = this.files.get(filePath);
        if (content === undefined) { throw new Error(`ENOENT: ${filePath}`); }
        return content;
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        this.files.set(filePath, content);
        this.directories.add(path.dirname(filePath));
    }

    async deleteFile(filePath: string): Promise<void> {
        if (!this.files.has(filePath)) { throw new Error(`ENOENT: ${filePath}`); }
        this.files.delete(filePath);
    }

    async moveFile(source: string, target: string): Promise<void> {
        const content = this.files.get(source);
        if (content === undefined) { throw new Error(`ENOENT: ${source}`); }
        this.files.set(target, content);
        this.files.delete(source);
        this.directories.add(path.dirname(target));
    }

    async createDirectory(dirPath: string): Promise<void> {
        this.directories.add(dirPath);
    }

    async listFiles(dirPath: string): Promise<string[]> {
        return [...this.files.keys()]
            .filter(f => path.dirname(f) === dirPath)
            .map(f => path.basename(f));
    }

    async fileExists(filePath: string): Promise<boolean> {
        return this.files.has(filePath);
    }

    async directoryExists(dirPath: string): Promise<boolean> {
        return this.directories.has(dirPath);
    }

    // Test helpers
    getFile(filePath: string): string | undefined {
        return this.files.get(filePath);
    }

    getAllFiles(): Map<string, string> {
        return new Map(this.files);
    }
}
