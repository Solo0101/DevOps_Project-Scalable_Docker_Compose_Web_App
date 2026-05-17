using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Item> Items => Set<Item>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Item>().HasData(
            new Item { Id = 1, Name = "Laptop", Description = "High-performance laptop", Price = 999.99m },
            new Item { Id = 2, Name = "Mouse", Description = "Wireless gaming mouse", Price = 49.99m },
            new Item { Id = 3, Name = "Keyboard", Description = "Mechanical keyboard", Price = 79.99m }
        );
    }
}
