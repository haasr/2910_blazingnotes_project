# Lesson 6: Layouts and `[CascadingParameter]`

Every page should show the list of categories in the sidebar. The sidebar lives in the **layout**, so the layout will load the categories once per request. Then you'll meet the second kind of component parameter, **`[CascadingParameter]`**, which hands that list to *any* component inside the page.

| | `[Parameter]` | `[CascadingParameter]` |
|---|---|---|
| Set by | The **direct parent**, as an attribute: `<NavMenu Categories="categories" />` (or a route segment) | **Any ancestor** that wraps it in `<CascadingValue>` |
| Reaches | Exactly one child | Every descendant, however deep |
| Matched by | Property **name** | Property **type** (or an optional `Name`) |
| Typical use | Ordinary component inputs (`NoteCard.Note`, route values like `Id`) | App-wide context: the current user, a theme, shared lookup data |

## 6.1 Load the categories once, in the layout

`MainLayout` is a component like any other, so it can `@inject` a service and fetch data in `OnInitializedAsync`. Replace **`Components/Layout/MainLayout.razor`**:

```razor
@inherits LayoutComponentBase
@inject NoteService Notes

<div class="app">
    <aside class="sidebar">
        @* [Parameter]: pass the list directly to one child component *@
        <NavMenu Categories="categories" />
    </aside>

    <main>
        @if (categories is not null)
        {
            @* [CascadingParameter]: make the list available to EVERY component inside @Body *@
            <CascadingValue Value="categories" IsFixed="true">
                @Body
            </CascadingValue>
        }
    </main>
</div>

<div id="blazor-error-ui" data-nosnippet>
    An unhandled error has occurred.
    <a href="." class="reload">Reload</a>
    <span class="dismiss">🗙</span>
</div>

@code {
    private List<Category>? categories;

    protected override async Task OnInitializedAsync()
    {
        categories = await Notes.GetCategoriesAsync();
    }
}
```

The layout uses the list in two ways:

1. **`<NavMenu Categories="categories" />`** passes it as a normal **`[Parameter]`**. `NavMenu` is a direct child, so this is the simple, explicit choice.
2. **`<CascadingValue Value="categories">`** wraps `@Body`. The current page, and any component inside that page, can receive the list without anyone passing it along by hand.

> **Why `@if (categories is not null)` around `@Body`?** When `OnInitializedAsync` hits its first `await`, Blazor **renders the component once right away** with whatever state it has, then renders again when the task completes. Without the `if`, the page inside `@Body` would be created during that first render and receive a `null` list. Delaying `@Body` until the data arrives guarantees every page sees the loaded list.

> **`IsFixed="true"`** promises Blazor that this value will never be replaced, so it doesn't need to track changes. That's a small performance win, and it's true here because the layout is created fresh for every request.

## 6.2 The sidebar: `[Parameter]`

Replace **`Components/Layout/NavMenu.razor`**:

```razor
<a class="brand" href="">🔥 BlazingNotes</a>

<nav class="nav flex-column">
    <NavLink class="nav-link" href="" Match="NavLinkMatch.All">All Notes</NavLink>

    <div class="sidebar-heading">Categories</div>

    @if (Categories is null || Categories.Count == 0)
    {
        <span class="meta px-2">No categories yet. Add one while editing a note.</span>
    }
    else
    {
        @* list.js conventions: container id, a "list" element, one <li> per item, a "name" value. *@
        <div id="category-list">
            <ul class="list">
                @foreach (Category category in Categories)
                {
                    <li>
                        <NavLink class="nav-link name" href="@($"categories/{category.Id}")" Match="NavLinkMatch.All">@category.Name</NavLink>
                    </li>
                }
            </ul>
        </div>
    }
</nav>

@code {
    // Passed in by MainLayout: <NavMenu Categories="categories" />
    [Parameter]
    public List<Category>? Categories { get; set; }
}
```

(We also removed the *Counter (demo)* link. You'll replace that demo with a real interactive component in Lesson 7.)

- `href="@($"categories/{category.Id}")"`: when a **component** parameter (`NavLink.Href`) mixes text and C#, wrap it in an explicit expression `@( ... )`. A plain HTML `<a>` accepts `href="categories/@category.Id"` directly.
- `Match="NavLinkMatch.All"` highlights the link only when the *whole* URL matches.
- The category list uses the **same list.js-ready structure as `NoteList`** (Lesson 5): a container with an id (`category-list`), a `<ul class="list">`, one `<li>` per category, and a value class (`name`) on the text. The starter stylesheet gives it a fixed height with `overflow-y: scroll`, so fifty categories won't push the rest of the sidebar off screen.

## 6.3 A page that receives a cascading parameter

The category page needs the category's name. The layout already has every category, so the page can **receive** the list instead of loading it again.

**`Components/Pages/Categories/CategoryNotes.razor`** (create the `Categories` folder):

```razor
@page "/categories/{Id:int}"
@inject NoteService Notes
@inject NavigationManager Navigation

@if (category is not null && notes is not null)
{
    <PageTitle>@category.Name - BlazingNotes</PageTitle>

    <h1 class="mb-4">@category.Name</h1>

    <NoteList Notes="notes" EmptyMessage="No notes in this category yet." />
}

@code {
    // From the URL: /categories/3 -> Id = 3
    [Parameter]
    public int Id { get; set; }

    // From MainLayout's <CascadingValue>: no extra database call needed to find the name.
    [CascadingParameter]
    public List<Category> AllCategories { get; set; } = default!;

    private Category? category;
    private List<Note>? notes;

    protected override async Task OnInitializedAsync()
    {
        category = AllCategories.FirstOrDefault(c => c.Id == Id);

        if (category is null)
        {
            Navigation.NotFound();
            return;
        }

        notes = await Notes.GetNotesAsync(categoryId: Id);
    }
}
```

This one page uses **both** kinds of parameters:

- `Id` is a `[Parameter]` filled from the route.
- `AllCategories` is a `[CascadingParameter]` filled by `MainLayout`.

The page never mentions `MainLayout`, and the layout never mentions this page. Blazor connects them by **type**: the nearest ancestor `<CascadingValue>` whose value is a `List<Category>` supplies the `[CascadingParameter]` of type `List<Category>`. The property name doesn't matter.

> **Two cascading values of the same type?** Give them names: `<CascadingValue Name="AllCategories" Value="...">` and `[CascadingParameter(Name = "AllCategories")]`.

> **Stuck? `NullReferenceException` on `AllCategories`.** Either the page isn't inside the `<CascadingValue>` (check `MainLayout`), or the types don't match exactly. `List<Category>` and `IEnumerable<Category>` are different types for this purpose.

> **Limit: cascading values don't cross into interactive components.** The layout here is statically rendered. A component with `@rendermode InteractiveServer` runs in a separate, live render tree (Lesson 7), and a `<CascadingValue>` in a static layout doesn't reach it. That's why the note editor in Lesson 7 loads its own category list.

## 6.4 Try it

1. The sidebar now shows the "Sample" category from Lesson 4 on every page.
2. Click it: the link is highlighted and the category's notes appear.
3. The category badge on a note's detail page now works too.
4. Visit `/categories/999`. You should get the Not Found page.

## 6.5 Check your understanding

1. What are the two kinds of parameters a component can receive, and how do they differ? *(`[Parameter]`: set explicitly by the direct parent, or by a route segment, and matched by name. `[CascadingParameter]`: supplied implicitly by any ancestor's `<CascadingValue>` and matched by type.)*
2. Why does the layout wait to render `@Body` until `categories` is loaded? *(Otherwise pages would be created during the first render, before the `await` completes, and receive `null`)*
3. Why is `[Parameter]` a better choice than a cascading value for `NavMenu`? *(It's one direct child, and an explicit attribute makes the data flow obvious)*

**Next:** [Lesson 7: Interactive components: `@rendermode InteractiveServer` and data binding](07-interactive-note-editor.md)
