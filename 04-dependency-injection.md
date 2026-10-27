# Lesson 4: Dependency Injection and a Data Access Service

In Lesson 2 you registered a context factory with `builder.Services.AddDbContextFactory<AppDbContext>(...)`, but you never wrote `new AppDbContext(...)` anywhere. This lesson explains who creates it, and why. Then you'll write **`NoteService`**, the one class in the app that reads and writes the database, and use it from a page with **`@inject`**.

## 4.1 The problem DI solves

Imagine a page that needs the database:

```csharp
// WITHOUT dependency injection
public class HomePage
{
    private readonly AppDbContext db;

    public HomePage()
    {
        DbContextOptions<AppDbContext> options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=blazingnotes.db")   // hard-coded!
            .Options;
        db = new AppDbContext(options);                 // who disposes this?
    }
}
```

This has several problems:

- **Every class that needs a database repeats this setup.** Changing the connection string means editing many files.
- **The class is tied to one concrete implementation.** In a unit test you can't swap in a fake or in-memory database.
- **Nobody manages the object's lifetime.** When is the connection closed? Is one context shared between users?

## 4.2 The idea: ask, don't create

**Dependency injection (DI)** means a class *declares* what it needs, usually as constructor parameters, and something else *supplies* it. That something is the **DI container** (also called the *service container*).

```csharp
// WITH dependency injection
public class NoteService
{
    private readonly IDbContextFactory<AppDbContext> dbFactory;

    public NoteService(IDbContextFactory<AppDbContext> dbFactory)   // "I need a context factory"
    {
        this.dbFactory = dbFactory;                                  // the container hands one over
    }
}
```

The class no longer knows or cares how the database is configured. That knowledge lives in **one place**: `Program.cs`.

## 4.3 How DI is managed in a Blazor Web App

Everything happens in `Program.cs` **before** `builder.Build()`:

```csharp
var builder = WebApplication.CreateBuilder(args);

// ---- Register services with the container ----
builder.Services.AddRazorComponents()                       // framework services
    .AddInteractiveServerComponents();

builder.Services.AddDbContextFactory<AppDbContext>(options =>   // our context factory
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();   // the container is now locked in
```

`builder.Services` is an `IServiceCollection`, a list of "recipes". Each registration says: *when someone asks for type X, here's how to make it, and here's how long it lives.*

### Service lifetimes

| Registration | Lifetime | Example use |
|---|---|---|
| `AddSingleton<T>()` | **One instance** for the whole app, shared by every user | Configuration, caches, the context factory |
| `AddScoped<T>()` | **One instance per scope**: per HTTP request, or per interactive *circuit* in Blazor (Lesson 7) | Our `NoteService` |
| `AddTransient<T>()` | **A new instance every time** it's requested | Small, stateless helpers |

The container also **disposes** objects at the end of their lifetime.

> **Rule of thumb:** a service should never depend on a service with a *shorter* lifetime. A singleton that held on to a scoped service would keep it alive forever and share it between all users.

### Two ways to receive a service

| Where | How |
|---|---|
| Regular C# classes (like `NoteService`) | **Constructor injection**: add a constructor parameter |
| Razor components (`.razor` files) | **The `@inject` directive**: `@inject NoteService Notes` |

`@inject Type PropertyName` creates a property on the component and fills it from the container before your code runs. It's the Razor equivalent of a constructor parameter.

## 4.4 Why a context *factory*?

`AppDbContext` is meant to be **short-lived**: create it, do one unit of work, dispose it. It also can't run two operations at once (Lesson 3).

In Lesson 7 you'll build an *interactive* component that stays alive on the server for as long as the user keeps the page open, possibly hours. If it held one `AppDbContext` that whole time, the context would grow stale and a double-click could start two operations at once.

The fix is to ask for a **factory** instead of a context. Each method in `NoteService` creates a fresh context, uses it, and disposes it:

```csharp
using AppDbContext db = dbFactory.CreateDbContext();   // fresh context for this method
// ... query or save ...
// `using` disposes the context automatically when the method ends
```

## 4.5 Write the data access service

Create a `Services` folder and add:

**`Services/NoteService.cs`**

```csharp
using BlazingNotes.Data;
using BlazingNotes.Models;
using Microsoft.EntityFrameworkCore;

namespace BlazingNotes.Services;

// The one place the app reads and writes notes and categories.
// Each method creates a short-lived AppDbContext, uses it, and disposes it.
public class NoteService
{
    private readonly IDbContextFactory<AppDbContext> dbFactory;

    public NoteService(IDbContextFactory<AppDbContext> dbFactory)
    {
        this.dbFactory = dbFactory;
    }

    // ---------- Notes ----------

    // All notes, or only the notes in one category. Newest first.
    public async Task<List<Note>> GetNotesAsync(int? categoryId = null)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        IQueryable<Note> query = db.Notes.Include(n => n.Categories);

        if (categoryId is not null)
        {
            query = query.Where(n => n.Categories.Any(c => c.Id == categoryId));
        }

        return await query.OrderByDescending(n => n.UpdatedAt).ToListAsync();
    }

    // Returns null when the note doesn't exist.
    public async Task<Note?> GetNoteAsync(int id)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        return await db.Notes
            .Include(n => n.Categories)
            .FirstOrDefaultAsync(n => n.Id == id);
    }

    // Creates the note when note.Id is 0, otherwise updates it. Returns the note's Id.
    public async Task<int> SaveNoteAsync(Note note, List<int> categoryIds)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        Note saved = note.Id == 0
            ? db.Notes.Add(new Note()).Entity
            : await db.Notes.Include(n => n.Categories).FirstAsync(n => n.Id == note.Id);

        saved.Title = note.Title;
        saved.Content = note.Content;
        saved.UpdatedAt = DateTime.UtcNow;
        saved.Categories = await db.Categories.Where(c => categoryIds.Contains(c.Id)).ToListAsync();

        await db.SaveChangesAsync();
        return saved.Id;
    }

    public async Task DeleteNoteAsync(int id)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        await db.Notes.Where(n => n.Id == id).ExecuteDeleteAsync();
    }

    // ---------- Categories ----------

    public async Task<List<Category>> GetCategoriesAsync()
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        return await db.Categories.OrderBy(c => c.Name).ToListAsync();
    }

    public async Task<Category> AddCategoryAsync(string name)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        Category category = new Category { Name = name };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    // Deletes the category only; its notes stay (the database removes the join-table rows).
    public async Task DeleteCategoryAsync(int id)
    {
        using AppDbContext db = dbFactory.CreateDbContext();

        await db.Categories.Where(c => c.Id == id).ExecuteDeleteAsync();
    }
}
```

Here's what's happening:

- **The factory comes in through the constructor.** `NoteService` never decides which database to use.
- **Every method is `async` and returns a `Task`** (Lesson 3). Each `await` gives the thread back while SQLite works.
- **`Include(n => n.Categories)`** tells EF Core to load each note's categories with a SQL join. Without it, `note.Categories` would be an empty list.
- **`IQueryable` builds a query step by step.** No SQL runs until `ToListAsync()`. The `if` adds a `.Where` only when a category was requested.
- **`SaveNoteAsync` handles both create and update.** A brand-new note has `Id == 0`, so it's added. Otherwise the existing note is loaded and its fields are overwritten. Assigning a new `Categories` list makes EF Core insert or delete the right `CategoryNote` join rows.
- **`ExecuteDeleteAsync`** deletes matching rows with a single `DELETE` statement, without loading them first. Deleting a category doesn't delete its notes; the database just removes the links in the join table.

## 4.6 Register the service

In **`Program.cs`**, add `using BlazingNotes.Services;` at the top, then register the service right after `AddDbContextFactory`:

```csharp
// Register our data access service.
builder.Services.AddScoped<NoteService>();
```

Now any component or class can ask for a `NoteService`, and the container will build one, passing in the factory it already knows about.

## 4.7 Add shared `@using` lines ⚠️ don't skip this step

Every `.razor` file automatically gets the `@using` lines in `Components/_Imports.razor`. Add these two lines **at the end** of that file:

```razor
@using BlazingNotes.Models
@using BlazingNotes.Services
```

> **Stuck? `The type or namespace name 'Note' could not be found`** (or `'NoteService'`, `'Category'`) in a `.razor` file: these `@using` lines are missing from `_Imports.razor`. A `.cs` file needs its own `using` lines at the top; a `.razor` file gets them from `_Imports.razor`.

## 4.8 Try it: test the service from a page

This is a **temporary** page to prove the service works. It also creates a sample note so the pages you build next have something to show. Lesson 5 replaces it. Replace **`Components/Pages/Home.razor`** with:

```razor
@page "/"
@inject NoteService Notes

<PageTitle>BlazingNotes</PageTitle>

<h1>All Notes</h1>

<p>The database has @noteCount notes and @categoryCount categories.</p>

@code {
    private int noteCount;
    private int categoryCount;

    protected override async Task OnInitializedAsync()
    {
        // Temporary test of NoteService: create sample data if the database is empty.
        // Lesson 5 replaces this page.
        if ((await Notes.GetNotesAsync()).Count == 0)
        {
            Category sample = await Notes.AddCategoryAsync("Sample");
            Note hello = new Note { Title = "Hello, Blazor!", Content = "NoteService created this note." };
            await Notes.SaveNoteAsync(hello, new List<int> { sample.Id });
        }

        noteCount = (await Notes.GetNotesAsync()).Count;
        categoryCount = (await Notes.GetCategoriesAsync()).Count;
    }
}
```

Run the app. You should see *"The database has 1 notes and 1 categories."* Refresh: the numbers stay the same, because the sample is only created when the database is empty.

What happened:

1. The router matched `/` to `Home.razor`.
2. Blazor created the component and saw `@inject NoteService Notes`.
3. It asked the container for a `NoteService`. The container saw that `NoteService` needs an `IDbContextFactory<AppDbContext>`, got that first, and passed it to the constructor.
4. Blazor called `OnInitializedAsync()`, which called the service. Each service method created, used, and disposed its own `AppDbContext`.
5. The markup rendered with the results.

> **Stuck? `Cannot provide a value for property 'Notes' on type 'BlazingNotes.Components.Pages.Home'. There is no registered service of type 'BlazingNotes.Services.NoteService'.`**
> You're asking the container for something it has no recipe for. Check the `AddScoped<NoteService>()` line in `Program.cs` and make sure it comes **before** `builder.Build()`.

## 4.9 Check your understanding

1. Where are services registered in a Blazor Web App? *(`Program.cs`, on `builder.Services`, before `builder.Build()`)*
2. Which Razor directive asks the DI container for a service? *(`@inject`)*
3. How does `NoteService` get its context factory? *(Constructor injection: the container sees the constructor parameter and supplies the registered factory)*
4. Why does `NoteService` create a new `AppDbContext` in every method instead of keeping one? *(Contexts should be short-lived and can't run two operations at once; interactive components can live for hours)*

**Next:** [Lesson 5: Server-rendered pages, routing, and `[Parameter]`](05-pages-and-parameters.md)
