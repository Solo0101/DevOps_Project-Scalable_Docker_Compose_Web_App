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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Item Manager';
  http = inject(HttpClient);
  items: Item[] = [];
  loading = true;
  error = '';

  newItem = { name: '', description: '', price: 0 };
  showForm = false;
  successMessage = '';

  ngOnInit(): void {
    this.loadItems();
  }

  loadItems(): void {
    this.loading = true;
    this.error = '';
    this.http.get<Item[]>('http://localhost:5000/api/items').subscribe({
      next: (data) => {
        this.items = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load items. Make sure the backend is running.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  addItem(): void {
    if (!this.newItem.name.trim()) return;
    this.http.post('http://localhost:5000/api/items', this.newItem).subscribe({
      next: () => {
        this.newItem = { name: '', description: '', price: 0 };
        this.showForm = false;
        this.loadItems();
        this.successMessage = 'Item added successfully!';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.error = 'Failed to add item.';
        console.error(err);
      }
    });
  }

  deleteItem(id: number): void {
    this.http.delete(`http://localhost:5000/api/items/${id}`).subscribe({
      next: () => this.loadItems(),
      error: (err) => {
        this.error = 'Failed to delete item.';
        console.error(err);
      }
    });
  }
}
