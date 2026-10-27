# Lesson 9: Review: Questions and Answers

You've built BlazingNotes. This lesson collects the big ideas as questions and answers. Try answering each one yourself before reading the answer.

## The finished project

```
BlazingNotes/
├── Program.cs                         entry point: DI registrations + request pipeline
├── appsettings.json                   connection string
├── Models/
│   └── Note.cs, Category.cs           EF Core entities (database tables)
├── Data/
│   ├── AppDbContext.cs                the database context
│   └── Migrations/                    generated schema changes
├── Services/
│   └── NoteService.cs                 the one class that reads and writes data
├── wwwroot/
│   ├── app.css                        starter stylesheet
│   └── js/confirmActions.js           "Are you sure?" for data-confirm forms
└── Components/
    ├── App.razor                      <html>, <head>, <body>
    ├── Routes.razor                   router
    ├── Layout/MainLayout.razor        loads categories, cascades them, hosts @Body
    ├── Layout/NavMenu.razor           sidebar (receives categories via [Parameter])
    ├── Shared/                        NoteCard, NoteList (list.js-ready), NoteEditor (interactive)
    └── Pages/                         Home, Notes/*, Categories/*
```

| Concept | Where it lives in BlazingNotes |
|---|---|
| Models / data layer | `Models/*.cs` + `Data/AppDbContext.cs` |
| Database migrations (follow model changes) | `dotnet ef migrations add` / `dotnet ef database update` |
| Data access service | `Services/NoteService.cs`, used through `@inject` |
| Main HTML document (`<head>` and `<body>`) | `App.razor` |
| Shared page layout | `MainLayout.razor` + `@Body` |
| URL routing | `@page` directives |
| Data shared by every page | layout + `<CascadingValue>` |
| Interactive form with data binding | `NoteEditor.razor` (`@rendermode InteractiveServer`, `@bind`) |
| Server-rendered form | the Delete buttons (`<form method="post">`, `@onsubmit`, `@formname`) |
| Cross-site request forgery protection | `<AntiforgeryToken />` |

---

## Questions and answers

**How is a Blazor Web App project organized?**
`Program.cs` configures services and the pipeline. `Components/` holds all Razor components: `App.razor` (the HTML document), `Routes.razor` (the router), `Layout/` (shared page frames), and `Pages/` (routable components with `@page`). `wwwroot/` holds static files. `appsettings.json` holds configuration. We added `Models/`, `Data/`, and `Services/` to keep data access out of the pages. *(Lesson 1)*

**Which file has the main HTML (the `<head>` and `<body>`)?**
`Components/App.razor`. Every page is rendered inside its `<Routes />` component, which renders the layout, and the layout renders the page at `@Body`. *(Lesson 1)*

**What is the entry point of a Blazor Web App?**
`Program.cs`. It creates a `WebApplicationBuilder`, registers services on `builder.Services`, calls `builder.Build()`, adds middleware and endpoints (`UseAntiforgery`, `MapStaticAssets`, `MapRazorComponents<App>`), and calls `app.Run()`. *(Lesson 1)*

**How do you create the database context and the database?**
Write model classes, then a class that inherits `DbContext` with a `DbSet<T>` per table. Register it in `Program.cs` (we used `AddDbContextFactory` with `UseSqlite` and a connection string from `appsettings.json`). Then run `dotnet ef migrations add InitialCreate` to generate a migration and `dotnet ef database update` to apply it. Repeat both commands whenever a model changes. *(Lesson 2)*

**What is synchronous vs. asynchronous code, and how does `Task<T>` work?**
Synchronous I/O blocks a thread until the result arrives. Asynchronous I/O starts the operation and returns a `Task<T>` immediately: an object representing a future `T`, or a failure. `await` suspends the method without blocking a thread and resumes it when the task completes. `async` methods return `Task` or `Task<T>`, and async "flows up" the call chain. Never use `.Result` or `.Wait()`. *(Lesson 3)*

**What is dependency injection, and how is it managed in a Blazor Web App?**
DI means a class *declares* what it needs, through a constructor parameter or `@inject`, and a **container** supplies it, instead of the class creating its own dependencies. In a Blazor Web App, services are registered in `Program.cs` on `builder.Services` with a lifetime: `AddSingleton`, `AddScoped` (our `NoteService`), or `AddTransient`. Helpers like `AddDbContextFactory` register services for you. The container creates, shares, and disposes instances according to their lifetime. *(Lesson 4)*

**Which Blazor directive should you use to work with a data access service on a page?**
`@inject`, for example `@inject NoteService Notes`. *(Lesson 4)*

**Which component lifecycle method is a good place to fetch data?**
`OnInitializedAsync`. It runs once when the component is created, and Blazor awaits its `Task` before (or, with streaming, while) rendering. *(Lessons 3–5)*

**Which pages follow the request/response (MVC-style) cycle, and how does it work?**
Every page except the note editor: Home, Note Detail, and Category Notes, plus the layout and sidebar. For each browser request, the page's `OnInitializedAsync` gets data from `NoteService`, renders HTML, and sends it, and the server forgets the page. The Delete buttons POST back to the page, which deletes and **redirects** (Post/Redirect/Get). In MVC terms, the model is our entities and `NoteService`, the view is the markup, and the page's `@code` block plays the controller. *(Lessons 5, 8)*

**What are the two types of parameters Blazor components use to receive inputs?**
`[Parameter]`: set explicitly by the direct parent as an attribute (`<NoteCard Note="note" />`), or filled from a route segment (`@page "/notes/{Id:int}"`), and matched by name. `[CascadingParameter]`: supplied implicitly by any ancestor's `<CascadingValue>` and matched by type (or name). *(Lessons 5–6)*

**What is data binding in a Razor component?**
Automatically keeping a UI element and a C# value in sync. One-way binding (`@note.Title`, `checked="@isChecked"`) writes C# values into the markup on each render. Two-way binding (`@bind="note.Title"`) also writes user changes back into the C# field when the bound event fires. *(Lesson 7)*

**How do you bind data to a UI element like an input field or textarea?**
`<input @bind="note.Title" />` or `<textarea @bind="note.Content"></textarea>`. The default updates on `onchange` (when focus leaves); add `@bind:event="oninput"` to update on every keystroke. *(Lesson 7)*

**How do you make a Blazor component interactive so it can handle UI events?**
Give it an interactive render mode: `@rendermode InteractiveServer` at the top of the component, or `<MyComponent @rendermode="InteractiveServer" />` where it's used. `Program.cs` must include `.AddInteractiveServerComponents()` and `.AddInteractiveServerRenderMode()`. Without a render mode, a component is statically rendered and `@onclick` does nothing. (Only `@onsubmit` on a form works, via a real POST.) *(Lessons 1, 7)*

**How does an interactive component manage state in InteractiveServer render mode, and how is that different from the request/response pages?**
The component instance lives **on the server** for the lifetime of a **circuit** (a SignalR WebSocket connection). Its fields *are* the state. UI events travel over the WebSocket, `@bind` updates fields, handlers run, and Blazor re-renders, diffs, and sends small DOM patches back. It saves to the database through `NoteService` when the user clicks Save. A static page, by contrast, keeps **no** state: each request rebuilds everything from the URL and the database, and returns a full page. *(Lesson 7)*

**What happens to a component immediately after it handles a UI event?**
Blazor automatically calls `StateHasChanged()`, re-renders the component, compares the new output with the previous output, and sends only the differences to the browser. An `async` handler also triggers a render at its first incomplete `await`. *(Lesson 7)*

**What are valid Razor directives?**
`@page`, `@rendermode`, `@inject`, `@using`, `@code`, `@layout`, `@inherits`, `@implements`, `@attribute`, `@namespace`, `@typeparam`, `@preservewhitespace`. Directive *attributes* on elements include `@onclick` (and other `@on{event}`), `@bind`, `@bind:event`, `@bind-Value`, `@formname`, `@key`, `@ref`, and `@rendermode` on a component instance. *(Lesson 1)*

---

## Extension exercises

1. **A category form.** Add a `/categories/new` page with a server-rendered `EditForm`, `[SupplyParameterFromForm]`, and `DataAnnotationsValidator`. Compare it with the interactive editor: where does validation happen, and how many requests does each one take?
2. **Sort the notes list.** `NoteList` and the sidebar already follow list.js conventions (Lesson 5). Load list.js from a CDN in `App.razor`, add `<button class="sort" data-sort="title">Sort by title</button>` inside `#note-list`, and call `new List("note-list", { valueNames: ["title", "categories", { name: "updated", attr: "data-updated" }] })`. Hint: enhanced navigation (Lesson 5) swaps page content without reloading, so a script that runs once on page load won't run again after you click a link. Run your setup code in `Blazor.addEventListener("enhancedload", ...)` as well. How many lines of `NoteList.razor` or `NoteCard.razor` did you have to change?
3. **Pinned notes.** Add a `bool IsPinned` property to `Note`, create a migration, and show pinned notes first. Which files did you have to change?
4. **Prerendering.** Add `Console.WriteLine` to `NoteEditor.OnInitializedAsync` and confirm it runs twice. Then try `new InteractiveServerRenderMode(prerender: false)` and describe the difference the user sees.
5. **Live preview.** Add a preview pane next to the editor that shows the title and content as they'll appear on the note page, updating as you type. How much C# did it take?
