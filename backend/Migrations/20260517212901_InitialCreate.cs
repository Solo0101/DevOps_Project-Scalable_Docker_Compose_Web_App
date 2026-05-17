using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Items",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Price = table.Column<decimal>(type: "numeric", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Items", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "Items",
                columns: new[] { "Id", "CreatedAt", "Description", "Name", "Price" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 5, 17, 21, 29, 0, 3, DateTimeKind.Utc).AddTicks(3219), "High-performance laptop", "Laptop", 999.99m },
                    { 2, new DateTime(2026, 5, 17, 21, 29, 0, 3, DateTimeKind.Utc).AddTicks(3786), "Wireless gaming mouse", "Mouse", 49.99m },
                    { 3, new DateTime(2026, 5, 17, 21, 29, 0, 3, DateTimeKind.Utc).AddTicks(3788), "Mechanical keyboard", "Keyboard", 79.99m }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Items");
        }
    }
}
