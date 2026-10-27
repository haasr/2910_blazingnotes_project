# Lesson 5: Server-Rendered Pages, Routing, and `[Parameter]`

You have a database (Lesson 2) and a service that reads and writes it (Lesson 4). Now you'll build the pages that **show** notes: the home page list and a page for a single note. Along the way you'll meet the first of Blazor's two kinds of component parameters: **`[Parameter]`**.

## 5.1 Static server-side rendering and the request/response cycle

A Razor component without a `@rendermode` directive uses **static server-side rendering (SSR)**. For each request:

1. The browser requests a URL such as `/notes/5`.
2. The server creates the page component, runs `OnInitializedAsync` to fetch its data, and renders it to HTML.
3. The server sends the HTML and **throws the component away**.
4. The browser displays the HTML. There's no live connection: `@onclick` handlers don't work, but links and HTML forms do.

<figure>
    <object data="https://github.com/haasr/2910_blazingnotes_project/raw/refs/heads/main/figures/05-static-ssr-render.svg" type="image/svg+xml"></object>
    <figcaption>A Razor component with no @rendermode directive, handling GET /notes/5</figcaption>
<figure>

The server keeps **no memory** of the page after sending it. Each request starts from scratch: load data, build HTML, send, forget. This is the classic web **request/response cycle**. Lesson 7 contrasts it with interactive components, which *do* keep state between events.

> **A word about MVC.** Many web frameworks organize this cycle with the **Model-View-Controller** pattern: the *Model* is the data (our `Note`/`Category` classes and `NoteService`), the *View* turns data into HTML (the page's markup), and the *Controller* handles the request and picks the data (here, the page's `@code` block). Blazor puts the view and its request-handling code in one component file, but keeping data access in a separate service, as we do, preserves the most useful part of that separation.

> **Enhanced navigation.** When you click a link, `blazor.web.js` intercepts it, fetches the new page with `fetch()`, and swaps in only what changed instead of doing a full browser reload. It's faster and smoother, but it's still a normal request/response. The server works exactly as in the diagram.

## 5.2 One more shared `@using` line ⚠️ don't skip this step

You're about to create a `Components/Shared` folder for reusable components. Add this line **at the end** of **`Components/_Imports.razor`**:

```razor
@using BlazingNotes.Components.Shared
```

> **Stuck? `Found markup element with unexpected name 'NoteList'`** (a warning) and the list never appears: this line is missing. Without it, Razor treats `<NoteList>` as an unknown HTML tag instead of your component.

## 5.3 Small reusable components with `[Parameter]`

Several pages show a list of note cards. Instead of repeating that markup, make it a component. Create the `Components/Shared/` folder:

**`Components/Shared/NoteCard.razor`**

```razor
@* The "title", "categories" and "updated" classes are list.js value names (see NoteList). *@
<div class="note-card">
    <h3 class="mb-2">
        <a class="title" href="notes/@Note.Id">@Note.Title</a>
    </h3>

    <div class="categories mb-2">
        @foreach (Category category in Note.Categories)
        {
            <span class="badge-category">@category.Name</span>
        }
    </div>

    <p class="meta mb-3">
        Updated <span class="updated" data-updated="@Note.UpdatedAt.ToString("o")">@Note.UpdatedAt.ToLocalTime().ToString("MMM d, yyyy h:mm tt")</span>
    </p>

    <a href="notes/@Note.Id" class="btn btn-sm btn-outline-primary">View</a>
</div>

@code {
    // The parent page passes a note in: <NoteCard Note="note" />
    [Parameter, EditorRequired]
    public Note Note { get; set; } = default!;
}
```

**`Components/Shared/NoteList.razor`**

```razor
@*
    Markup follows list.js conventions (https://listjs.com), so search, filter and
    sort controls can be added later without changing this structure:
      - a container with an id            -> <div id="note-list">
      - an element with class "list"      -> <ul class="list">
      - one direct child per item         -> <li>
      - value elements inside each item   -> .title, .categories, .updated (in NoteCard)
*@
<div id="@Id" class="note-list">
    @if (Notes.Count == 0)
    {
        <div class="empty-state">
            <h3>@EmptyMessage</h3>
        </div>
    }
    else
    {
        <ul class="list">
            @foreach (Note note in Notes)
            {
                <li>
                    <NoteCard Note="note" />
                </li>
            }
        </ul>
    }
</div>

@code {
    [Parameter, EditorRequired]
    public List<Note> Notes { get; set; } = default!;

    [Parameter]
    public string EmptyMessage { get; set; } = "No notes yet";

    // The container's id. list.js finds a list by this id: new List("note-list", ...)
    [Parameter]
    public string Id { get; set; } = "note-list";
}
```

A public property marked **`[Parameter]`** is an **input** to the component. The parent sets it with an HTML-attribute-like syntax: `<NoteCard Note="note" />`. `[EditorRequired]` makes the compiler warn if a parent forgets it. Data flows **one way, down**: parent → child.

Notice the Razor syntax: `@foreach` and `@if` are ordinary C# statements mixed with markup. `@Note.Title` outputs a value, and Razor **HTML-encodes** it automatically, so a title like `<script>` is shown as text and never executed.

### Why the list markup looks like this

A user might write hundreds of notes, so the list can't grow the page forever. The starter stylesheet gives `.note-list .list` a **fixed height** with `overflow-y: scroll`, so the cards scroll inside their own box. You don't write any CSS for this; just use the class names shown.

The structure also follows the conventions of [**list.js**](https://listjs.com), a small JavaScript library that adds search, filtering, and sorting to existing HTML lists:

```html
<div id="note-list">                      ← list.js finds the list by this id
    <!-- later: <input class="search">, <button class="sort" data-sort="title"> -->
    <ul class="list">                     ← the element whose children are the items
        <li>                              ← one item
            <a class="title">...</a>      ← "value names": the fields list.js can
            <div class="categories">...</div>    search, filter and sort on
            <span class="updated" data-updated="2026-10-26T17:31:15">...</span>
        </li>
    </ul>
</div>
```

We aren't using list.js in this course. But because the markup already follows its rules, adding search or sorting later only means dropping an `<input class="search">` into the container and calling `new List("note-list", { valueNames: [...] })`, with no change to `NoteList` or `NoteCard`. That's a good design habit in general: **give data in your markup meaningful class names and a predictable structure**, and future features can hook into it.

## 5.4 The home page: all notes

Replace the temporary **`Components/Pages/Home.razor`** from Lesson 4:

```razor
@page "/"
@inject NoteService Notes

<PageTitle>All Notes - BlazingNotes</PageTitle>

<h1 class="mb-4">All Notes</h1>

@if (notes is null)
{
    <p>Loading...</p>
}
else
{
    <NoteList Notes="notes" EmptyMessage="No notes yet. Create your first one!" />
}

@code {
    private List<Note>? notes;

    protected override async Task OnInitializedAsync()
    {
        notes = await Notes.GetNotesAsync();
    }
}
```

`@inject NoteService Notes` gives the page the data access service, and **`OnInitializedAsync`** is where it fetches data.

> **Why check for `null`?** `notes` is `null` until `OnInitializedAsync` finishes. With plain static SSR the server waits before sending HTML, so you never see "Loading...". If you add `@attribute [StreamRendering]` to a page, Blazor sends the page *first* with "Loading..." and streams in the real content when the task completes. Try it!

## 5.5 The note page: a route parameter

**`Components/Pages/Notes/NoteDetail.razor`** (create the `Notes` folder):

```razor
@page "/notes/{Id:int}"
@inject NoteService Notes
@inject NavigationManager Navigation

@if (note is not null)
{
    <PageTitle>@note.Title - BlazingNotes</PageTitle>

    <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
            <li class="breadcrumb-item"><a href="">All Notes</a></li>
            <li class="breadcrumb-item active">@note.Title</li>
        </ol>
    </nav>

    <div class="note-card">
        <h1 class="mb-2">@note.Title</h1>

        <div class="mb-3">
            @foreach (Category category in note.Categories)
            {
                <a class="badge-category text-decoration-none" href="categories/@category.Id">@category.Name</a>
            }
        </div>

        <div class="note-content mb-4">@note.Content</div>

        <p class="meta">
            Created @note.CreatedAt.ToLocalTime().ToString("MMM d, yyyy h:mm tt")
            · Updated @note.UpdatedAt.ToLocalTime().ToString("MMM d, yyyy h:mm tt")
        </p>
    </div>
}

@code {
    // Filled from the {Id:int} segment of the URL, e.g. /notes/5 -> Id = 5
    [Parameter]
    public int Id { get; set; }

    private Note? note;

    protected override async Task OnInitializedAsync()
    {
        note = await Notes.GetNoteAsync(Id);

        if (note is null)
        {
            Navigation.NotFound(); // renders the NotFound page with a 404 status
        }
    }
}
```

- `{Id:int}` in `@page` is a **route parameter** with an `int` **constraint**. Blazor converts the URL segment and assigns it to the `[Parameter]` property **with the same name** (case-insensitive). The same `[Parameter]` attribute you used in `NoteCard` works for route values too.
- `/notes/abc` doesn't match the route at all, so it's a 404.
- `NavigationManager.NotFound()` (new in .NET 10) renders `Components/Pages/NotFound.razor` and sets the HTTP status to 404.
- Relative links like `href="categories/3"` work because `App.razor` sets `<base href="/" />`, so every relative URL starts from the site root.

## 5.6 Try it

Run the app.

1. The home page shows the sample note from Lesson 4 as a card.
2. Click **View** to see its detail page. (Its category badge links to a page you'll build in Lesson 6, so it shows Not Found for now.)
3. Visit `/notes/999`. You should get the Not Found page.
4. Open the browser's developer tools (F12) → **Network** tab, and click between pages. Each navigation is a request that returns **HTML** built on the server.

## 5.7 Check your understanding

1. Which directive gives a page a data access service? *(`@inject`)*
2. What are two ways a `[Parameter]` gets its value in this lesson? *(From a parent component's attribute, like `<NoteCard Note="note" />`, and from a route segment, like `{Id:int}`)*
3. With static SSR, what happens to a page component after its HTML is sent? *(It's discarded. Nothing stays in server memory for that page.)*
4. Why does `NoteList` use `<ul class="list">` and give each card's title the class `title`? *(They follow list.js conventions, so search, filter, and sort controls can be added later without changing the components)*

**Next:** [Lesson 6: Layouts and `[CascadingParameter]`](06-layouts-and-cascading-parameters.md)
