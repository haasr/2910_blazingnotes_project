# Lesson 2: Models, the Database Context, and Migrations

In this lesson you'll describe the app's data as C# classes (the **Model**), create the **database context** that talks to SQLite, and use **migrations** to generate the database.

## 2.1 What is "the Model"?

In the Model-View-Controller (MVC) pattern, the **Model** is the data and the rules about that data. For BlazingNotes it's two things: notes and categories.

We'll use **Entity Framework Core (EF Core)**, an *object-relational mapper* (ORM). You write plain C# classes, and EF Core:

- creates the matching database tables
- converts rows to objects and objects to rows
- turns C# LINQ queries such as `db.Notes.Where(n => n.Title.Contains("x"))` into SQL

## 2.2 Install the packages

From the project folder (the one containing `BlazingNotes.csproj`):

```bash
dotnet add package Microsoft.EntityFrameworkCore --version 10.0.14
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 10.0.14
dotnet add package Microsoft.EntityFrameworkCore.Design --version 10.0.14
```

| Package | Why |
|---|---|
| `Microsoft.EntityFrameworkCore` | The ORM itself |
| `Microsoft.EntityFrameworkCore.Sqlite` | Lets EF Core talk to SQLite, a database stored in a single file |
| `Microsoft.EntityFrameworkCore.Design` | Needed by the `dotnet ef` migration tool at design time |

Then install the **`dotnet ef`** command-line tool *locally* for this project:

```bash
dotnet new tool-manifest
dotnet tool install dotnet-ef --version 10.0.14
```

This creates `dotnet-tools.json`. Anyone who clones the project later runs `dotnet tool restore` to get the same tool version.

> **Stuck? `Could not execute because the specified command or file was not found`** when running `dotnet ef`: you skipped `dotnet tool install`, or you're not in the project folder. Run `dotnet tool restore` from the project folder.

## 2.3 Write the models

Create a `Models` folder and add two classes.

**`Models/Note.cs`**

```csharp
using System.ComponentModel.DataAnnotations;

namespace BlazingNotes.Models;

public class Note
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = "";

    [Required]
    public string Content { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property: the categories this note belongs to (many-to-many).
    public List<Category> Categories { get; set; } = new();
}
```

**`Models/Category.cs`**

```csharp
using System.ComponentModel.DataAnnotations;

namespace BlazingNotes.Models;

public class Category
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property: the notes in this category (many-to-many).
    public List<Note> Notes { get; set; } = new();
}
```

EF Core follows some **conventions** here:

- A property named `Id` becomes the **primary key**, auto-incremented.
- `[Required]` makes the column `NOT NULL`, and `[MaxLength(200)]` limits its length. Attributes like these are called **data annotations**.
- `Note` has a `List<Category>` and `Category` has a `List<Note>`. EF Core recognizes that as **many-to-many** and creates a hidden *join table* (`CategoryNote`) for you.
- We store times in **UTC** (`DateTime.UtcNow`) and convert to local time only when displaying them.

## 2.4 Create the database context

The **database context** is the class you use to query and save data. It represents one "conversation" with the database. Create a `Data` folder:

**`Data/AppDbContext.cs`**

```csharp
using BlazingNotes.Models;
using Microsoft.EntityFrameworkCore;

namespace BlazingNotes.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Each DbSet becomes a table.
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Category> Categories => Set<Category>();
}
```

Look at the constructor. `AppDbContext` doesn't decide *which* database to use. It receives `options` from whoever creates it. Who creates it? A **factory** that we register with the **dependency injection container** in `Program.cs`. Dependency injection is the topic of Lesson 4; for now, just register it.

## 2.5 Configure the connection string and register a context factory

Add a connection string to **`appsettings.json`**:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=blazingnotes.db"
  },
  "Logging": { ... },
  "AllowedHosts": "*"
}
```

In **`Program.cs`**, add two `using` lines at the top:

```csharp
using BlazingNotes.Data;
using Microsoft.EntityFrameworkCore;
```

Then register a context factory **before** `var app = builder.Build();`:

```csharp
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

// Register a factory that creates AppDbContext instances for our database.
builder.Services.AddDbContextFactory<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));
```

A **factory** is an object whose job is to create other objects. Whenever our code needs to talk to the database, it asks the factory for a fresh `AppDbContext`, uses it for one task, and throws it away. Lesson 4 explains why short-lived contexts matter.

`builder.Configuration` reads `appsettings.json` (and `appsettings.Development.json`, environment variables, and more). Keeping the connection string out of the code means you can point the app at a different database without recompiling.

## 2.6 Migrations: from C# classes to tables

A **migration** is a generated C# file describing how to change the database schema, for example "create table Notes" or "add column X". Create the first one:

```bash
dotnet ef migrations add InitialCreate --output-dir Data/Migrations
```

Open `Data/Migrations/<timestamp>_InitialCreate.cs`. You'll see three `CreateTable` calls: `Categories`, `Notes`, and the join table `CategoryNote`, with foreign keys to both. The `Up` method applies the change and `Down` reverses it.

Now apply it, which creates `blazingnotes.db`:

```bash
dotnet ef database update
```

**Whenever you change a model later** (add a property, rename one, and so on), repeat both commands with a new descriptive migration name, for example `dotnet ef migrations add AddNotePinned`.

> **Stuck? `Unable to create a 'DbContext' of type...`**: `dotnet ef` builds and *starts* your app to find the context. Usually either the `AddDbContextFactory` line is missing from `Program.cs` or the project doesn't compile. Run `dotnet build` and fix the first error it reports. A typo such as `using MicrosoftEntityFrameworkCore;` (missing a dot) is enough to stop `dotnet ef` with an error like *"The type or namespace name ... could not be found"*.

> Add `*.db` to your `.gitignore`. The database is generated from the migrations, so don't commit it.

**Optional:** to look inside the database, install a SQLite viewer (for example the "SQLite Viewer" extension for VS Code, or *DB Browser for SQLite*) and open `blazingnotes.db`.

## 2.7 Check your understanding

1. What does EF Core do with the `Id` property? *(Makes it the auto-increment primary key)*
2. Where is the many-to-many join table defined in your code? *(Nowhere explicitly. EF Core infers it from the two `List<>` navigation properties.)*
3. Why does `AppDbContext` take `DbContextOptions` in its constructor instead of calling `UseSqlite` itself? *(So the configuration is decided in one place, `Program.cs`, and supplied when the factory creates the context. See Lesson 4.)*

**Next:** [Lesson 3: Synchronous vs. asynchronous code and `Task<T>`](03-async-and-tasks.md)
