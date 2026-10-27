# Lesson 1: Creating the Project and Touring a Blazor Web App

In this series you'll build a small note-taking app called **BlazingNotes**. Users can:

- create, view, edit, and delete notes
- organize notes into categories (a note can have many categories, and a category can have many notes)
- browse notes by category

The goal is to learn architecture and programming concepts, not design. A ready-made stylesheet is provided, so you'll spend almost no time on CSS.

| Lesson | Topic |
|---|---|
| **1** | **Creating the project and touring a Blazor Web App** |
| 2 | Models, the database context, and migrations |
| 3 | Synchronous vs. asynchronous code and `Task<T>` |
| 4 | Dependency injection and a data access service |
| 5 | Server-rendered pages, routing, and `[Parameter]` |
| 6 | Layouts and `[CascadingParameter]` |
| 7 | Interactive components: `@rendermode InteractiveServer` and data binding |
| 8 | Deleting with small forms and `confirmActions.js` |
| 9 | Review: questions and answers |

---

## 1.1 Prerequisites

You need the **.NET 10 SDK**. Check your version:

```bash
dotnet --version
```

It should print `10.0.something`. If it prints 9.x or lower, install .NET 10 from <https://dotnet.microsoft.com/download> before continuing. The NuGet packages used in Lesson 2 (version 10.0.x) **don't work** with older SDKs.

> **Stuck? "A compatible .NET SDK was not found"**
> Some machines have more than one `dotnet` installed. Run `which -a dotnet` (macOS/Linux) or `where dotnet` (Windows). The first one listed is the one that runs. Make sure the .NET 10 one comes first on your `PATH`. If you set `DOTNET_ROOT` in your shell profile, point it at the same install.

## 1.2 Create the project

```bash
mkdir BlazingNotes
cd BlazingNotes
dotnet new globaljson --sdk-version 10.0.100 --roll-forward latestFeature
dotnet new blazor -n BlazingNotes -o .
```

- `global.json` pins this folder to SDK 10.0.100 or any newer 10.0.x. If someone opens the project with the wrong SDK, they get a clear error instead of strange build failures.
- `dotnet new blazor` creates a **Blazor Web App**. By default it uses *Server* interactivity, configured *per page/component*. That's exactly the setup we want: most pages will be plain server-rendered HTML, and you'll opt individual components into interactivity.

Run it:

```bash
dotnet run --launch-profile http
```

Open the URL printed in the terminal, for example `http://localhost:5140`. Your port number may differ.

> We use the `http` profile to avoid HTTPS development-certificate prompts while you develop.

Stop the app with **Ctrl+C**.

## 1.3 How a Blazor Web App project is organized

```
BlazingNotes/
├── BlazingNotes.csproj        ← project file: target framework, NuGet packages
├── global.json                ← pins the SDK version
├── Program.cs                 ← ENTRY POINT: configures services and the HTTP pipeline
├── appsettings.json           ← configuration (connection strings, URLs, logging)
├── appsettings.Development.json
├── Properties/
│   └── launchSettings.json    ← how `dotnet run` starts the app (ports, environment)
├── wwwroot/                   ← static files served as-is (CSS, images, JS libraries)
│   ├── app.css
│   └── lib/bootstrap/
└── Components/
    ├── App.razor              ← the root HTML document: <html>, <head>, <body>
    ├── Routes.razor           ← the router: maps URLs to page components
    ├── _Imports.razor         ← @using lines shared by every .razor file
    ├── Layout/
    │   ├── MainLayout.razor   ← the shared page "frame" (sidebar + content area)
    │   ├── NavMenu.razor
    │   └── ReconnectModal.razor
    └── Pages/                 ← routable components (each has an @page directive)
        ├── Home.razor
        ├── Counter.razor
        ├── Weather.razor
        ├── Error.razor
        └── NotFound.razor
```

Over the next lessons you'll add three folders the template doesn't have:

```
├── Models/        ← C# classes describing our data (Note, Category)
├── Data/          ← the EF Core database context and migrations
└── Services/      ← NoteService: the one class that reads and writes data
```

### `Program.cs` is the entry point

Like any C# console program, a Blazor Web App starts at `Program.cs`. It uses top-level statements, so there's no `static void Main`, but the compiler generates one. Open it:

```csharp
var builder = WebApplication.CreateBuilder(args);       // 1. create a builder

// Add services to the container.
builder.Services.AddRazorComponents()                   // 2. register services
    .AddInteractiveServerComponents();

var app = builder.Build();                              // 3. build the app

// Configure the HTTP request pipeline.                 // 4. add middleware
app.UseAntiforgery();
app.MapStaticAssets();
app.MapRazorComponents<App>()                           // 5. App.razor is the root component
    .AddInteractiveServerRenderMode();

app.Run();                                              // 6. start listening for requests
```

`Program.cs` always has two halves:

1. **Before `builder.Build()`**: register **services** in `builder.Services`. This is the *dependency injection container* (Lesson 4).
2. **After `builder.Build()`**: configure the **request pipeline**. Each `app.UseXxx()` / `app.MapXxx()` call adds a step that every HTTP request passes through.

### `App.razor` has the main HTML

`Components/App.razor` is the only file with `<html>`, `<head>`, and `<body>`. Every page you build is rendered *inside* it:

```html
<head>
    ...
    <link rel="stylesheet" href="@Assets["lib/bootstrap/dist/css/bootstrap.min.css"]" />
    <link rel="stylesheet" href="@Assets["app.css"]" />
    <HeadOutlet />                    ← pages put their <PageTitle> here
</head>
<body>
    <Routes />                        ← the router renders the current page here
    <script src="@Assets["_framework/blazor.web.js"]"></script>
</body>
```

The `blazor.web.js` script is what makes interactivity possible later. It opens a real-time connection back to the server.

### `Routes.razor` and the layout

`Routes.razor` contains a `<Router>`. It finds the component whose `@page` directive matches the URL and renders it *inside* `MainLayout.razor`, wherever the layout writes `@Body`:

```
App.razor  →  Routes.razor  →  MainLayout.razor  →  @Body = the matched page
```

### Razor components

Every `.razor` file is a **Razor component**: a C# class written as HTML markup mixed with C#. `Counter.razor` shows the whole idea:

```razor
@page "/counter"
@rendermode InteractiveServer

<h1>Counter</h1>
<p role="status">Current count: @currentCount</p>
<button class="btn btn-primary" @onclick="IncrementCount">Click me</button>

@code {
    private int currentCount = 0;

    private void IncrementCount()
    {
        currentCount++;
    }
}
```

- Lines starting with `@` are **directives** or C# expressions. `@currentCount` writes a C# value into the HTML.
- The `@code { }` block is ordinary C#: fields, properties, and methods of the component class.
- `@page "/counter"` makes the component **routable**: visiting `/counter` renders it.
- `@rendermode InteractiveServer` makes it **interactive**. Without that line, the `@onclick` would do nothing. Lessons 5 and 7 explain why.

### Razor directives you'll use

| Directive | Purpose |
|---|---|
| `@page "/route"` | Make the component a page reachable at that URL |
| `@rendermode InteractiveServer` | Make the component handle UI events over a live server connection |
| `@inject Type Name` | Ask dependency injection for a service (Lesson 4) |
| `@using Namespace` | Like `using` in C# |
| `@code { }` | The component's C# members |
| `@layout LayoutType` | Use a different layout for this page |
| `@inherits BaseClass` | Choose the component's base class (`MainLayout` inherits `LayoutComponentBase`) |
| `@implements IInterface` | Implement an interface |
| `@attribute [Something]` | Put a C# attribute on the component class |
| `@namespace` | Set the component's namespace |
| `@typeparam T` | Make a generic component |

Razor also has **directive attributes**, which you put on HTML elements: `@onclick`, `@onchange`, `@onsubmit`, `@bind`, `@bind:event`, `@formname`, `@key`, `@ref`. You'll use most of these.

## 1.4 Install the starter stylesheet and layout

The template's styling is replaced with a simple stylesheet built for this app.

0. Download and unzip <a href="https://github.com/haasr/2910_blazingnotes_project/raw/refs/heads/main/starter.zip" rel="noopener">starter.zip</a>
1. **Replace**  The contents of `wwwroot/app.css` with those of [`starter/app.css`](starter/app.css). Bootstrap 5 stays; `App.razor` already loads it.
2. **Delete** these files. They're "scoped CSS" files for the template's old layout:
   - `Components/Layout/MainLayout.razor.css`
   - `Components/Layout/NavMenu.razor.css`
3. **Replace** the contents of `Components/Layout/MainLayout.razor` with those of [`starter/MainLayout.razor`](starter/MainLayout.razor):

   ```razor
   @inherits LayoutComponentBase

   <div class="app">
       <aside class="sidebar">
           <NavMenu />
       </aside>

       <main>
           @Body
       </main>
   </div>

   <div id="blazor-error-ui" data-nosnippet>
       An unhandled error has occurred.
       <a href="." class="reload">Reload</a>
       <span class="dismiss">🗙</span>
   </div>
   ```

4. **Replace** `Components/Layout/NavMenu.razor` with [`starter/NavMenu.razor`](starter/NavMenu.razor):

   ```razor
   <a class="brand" href="">🔥 BlazingNotes</a>

   <nav class="nav flex-column">
       <NavLink class="nav-link" href="" Match="NavLinkMatch.All">All Notes</NavLink>
       <NavLink class="nav-link" href="counter">Counter (demo)</NavLink>
   </nav>
   ```

   `NavLink` is a built-in component. It renders an `<a>` tag and adds `class="active"` when the URL matches, which highlights the current page.

5. **Delete** `Components/Pages/Weather.razor`. We don't need it.

> **What's scoped CSS?** A file named `Something.razor.css` only applies to `Something.razor`. Blazor rewrites its selectors with a unique attribute such as `b-m3woo5ecca`. All of those files are bundled into `BlazingNotes.styles.css`, which `App.razor` links. We use one global `app.css` instead so you don't have to think about it.

Run `dotnet run --launch-profile http` again. You should see the new sidebar. Click **Counter (demo)** and press the button a few times.

## 1.5 Check your understanding

1. Which file contains `<head>` and `<body>`? *(`Components/App.razor`)*
2. Where does the app start, and what are its two halves? *(`Program.cs`: register services, then configure the request pipeline)*
3. Which directive makes a component reachable at a URL? *(`@page`)*
4. Delete the `@rendermode InteractiveServer` line from `Counter.razor`, restart, and click the button. What happens? Put the line back afterwards. *(Nothing. The page is now plain HTML with no live connection, so the click never reaches your C# code. Lesson 7 explains this in detail.)*

**Next:** [Lesson 2: Models, the database context, and migrations](02-models-and-database.md)
