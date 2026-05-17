import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Item {
  id: number;
  name: string;
  description: string;
  price: number;
  createdAt: string;
}

interface DraftItem extends Item {
  _tempId?: number;
  _isDraft?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  http = inject(HttpClient);
  items: Item[] = [];
  loading = true;
  error = '';
  successMsg = '';

  // Create form
  isCreateOpen = false;
  createForm: { name: string; description: string; price: string } = { name: '', description: '', price: '' };

  // Edit mode
  editingId: number | null = null;
  editDraft: { name: string; description: string; price: string } = { name: '', description: '', price: '' };

  // Preview
  previewMode: 'none' | 'create' | 'update' | 'delete' = 'none';
  previewItem: Item | null = null;
  previewAction: string = '';

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading = true;
    this.error = '';
    this.http.get<Item[]>('/api/items').subscribe({
      next: (data) => { this.items = data; this.loading = false; },
      error: () => { this.error = 'Failed to load items. Check backend.'; this.loading = false; }
    });
  }

  // --- Create ---
  openCreate(): void {
    this.isCreateOpen = true;
    this.createForm = { name: '', description: '', price: '' };
  }
  cancelCreate(): void { this.isCreateOpen = false; }

  previewCreate(): void {
    if (!this.createForm.name.trim()) return;
    this.previewItem = {
      id: 0,
      name: this.createForm.name,
      description: this.createForm.description,
      price: parseFloat(this.createForm.price) || 0,
      createdAt: new Date().toISOString()
    };
    this.previewAction = 'create';
    this.previewMode = 'create';
  }

  confirmCreate(): void {
    this.http.post('/api/items', {
      name: this.createForm.name,
      description: this.createForm.description,
      price: parseFloat(this.createForm.price) || 0
    }).subscribe({
      next: () => {
        this.isCreateOpen = false;
        this.previewMode = 'none';
        this.loadItems();
        this.flash('Item created!');
      },
      error: () => this.error = 'Failed to create item.'
    });
  }

  // --- Update ---
  startEdit(item: Item): void {
    this.editingId = item.id;
    this.editDraft = { name: item.name, description: item.description, price: String(item.price) };
  }
  cancelEdit(): void { this.editingId = null; }

  previewUpdate(): void {
    if (!this.editDraft.name.trim() || !this.editingId) return;
    const original = this.items.find(i => i.id === this.editingId);
    this.previewItem = {
      id: this.editingId,
      name: this.editDraft.name,
      description: this.editDraft.description,
      price: parseFloat(this.editDraft.price) || 0,
      createdAt: original?.createdAt || new Date().toISOString()
    };
    this.previewAction = 'update';
    this.previewMode = 'update';
  }

  confirmUpdate(): void {
    if (!this.editingId) return;
    this.http.put(`/api/items/${this.editingId}`, {
      id: this.editingId,
      name: this.editDraft.name,
      description: this.editDraft.description,
      price: parseFloat(this.editDraft.price) || 0
    }).subscribe({
      next: () => {
        this.editingId = null;
        this.previewMode = 'none';
        this.loadItems();
        this.flash('Item updated!');
      },
      error: () => this.error = 'Failed to update item.'
    });
  }

  // --- Delete ---
  previewDelete(item: Item): void {
    this.previewItem = item;
    this.previewAction = 'delete';
    this.previewMode = 'delete';
  }
  cancelDelete(): void { this.previewMode = 'none'; }

  confirmDelete(): void {
    if (!this.previewItem) return;
    this.http.delete(`/api/items/${this.previewItem.id}`).subscribe({
      next: () => {
        this.previewMode = 'none';
        this.loadItems();
        this.flash('Item deleted!');
      },
      error: () => this.error = 'Failed to delete item.'
    });
  }

  // --- Utilities ---
  flash(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => this.successMsg = '', 3000);
  }

  priceStr(item: Item): string {
    return `$${item.price.toFixed(2)}`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
}
