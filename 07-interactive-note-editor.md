# Lesson 7: Interactive Components: `@rendermode InteractiveServer` and Data Binding

Everything you've built so far follows the request/response cycle: the server renders HTML, sends it, and forgets. Now you'll build the **note editor** a different way: as an **interactive component** with **data binding**. It will:

- update a word count **as you type**
- enable the Save button only once the note has a title and content
- let you tick categories, and create a new category **without leaving the page**

None of this needs JavaScript. You write it all in C#.

## 7.1 How interactive server rendering works

Add `@rendermode InteractiveServer` to a component (or `@rendermode="InteractiveServer"` where you *use* one) and Blazor changes how it runs:


![InteractiveServer render mode diagram](figures/07-interactive-note-editor.svg)

Compare this with the pages from Lessons 5 and 6:

| | Static SSR pages (Lessons 5–6) | Interactive component (this lesson) |
|---|---|---|
| Connection | A separate HTTP request per action | One persistent WebSocket, the **circuit** |
| Where state lives | In the URL and the database. The server forgets the page after responding. | In the **component's C# fields**, kept in server memory for as long as the circuit is open |
| What triggers server work | Clicking a link or submitting a form | **Any UI event** you handle: `@onclick`, `@oninput`, `@onchange`, ... |
| What the server sends back | A whole HTML page | A small **diff** of only what changed |
| How the UI stays in sync with the data | It doesn't; the next request renders fresh HTML | **Data binding**: `@bind` keeps an element and a C# field in sync |

The interactive style looks a lot like **MVVM (Model-View-ViewModel)**. The component's `@code` block acts as a *ViewModel*: it holds state and commands (event-handler methods). The markup is the *View*, and `@bind` keeps the two in sync automatically. The *Model* is still our `Note` and `Category` classes, saved through `NoteService`.

## 7.2 The editor component

One component handles both creating and editing. It has **no** `@page` directive, because it isn't a page by itself; pages will host it.

**`Components/Shared/NoteEditor.razor`**

```razor
@inject NoteService Notes
@inject NavigationManager Navigation

@if (loading)
{
    <p>Loading...</p>
}
else
{
    <h1 class="mb-3">@(NoteId is null ? "New Note" : "Edit Note")</h1>

    <div class="note-card">
        @* Every keystroke updates note.Title / note.Content on the server. *@
        <div class="mb-3">
            <label for="title" class="form-label">Title</label>
            <input id="title" class="form-control" @bind="note.Title" @bind:event="oninput" />
        </div>

        <div class="mb-3">
            <label for="content" class="form-label">Content</label>
            <textarea id="content" class="form-control" rows="8"
                      @bind="note.Content" @bind:event="oninput"></textarea>
            <div class="meta mt-1">@WordCount words</div>
        </div>

        <div class="mb-3">
            <label class="form-label d-block">Categories</label>
            @foreach (Category category in categories)
            {
                <div class="form-check form-check-inline">
                    <input type="checkbox" class="form-check-input" id="cat-@category.Id"
                           checked="@selectedCategoryIds.Contains(category.Id)"
                           @onchange="e => ToggleCategory(category.Id, (bool)e.Value!)" />
                    <label class="form-check-label" for="cat-@category.Id">@category.Name</label>
                </div>
            }

            <div class="input-group input-group-sm mt-2" style="max-width: 320px">
                <input class="form-control" placeholder="New category..." @bind="newCategoryName" />
                <button class="btn btn-outline-secondary" @onclick="AddCategoryAsync"
                        disabled="@string.IsNullOrWhiteSpace(newCategoryName)">Add</button>
            </div>
        </div>

        <button class="btn btn-primary" @onclick="SaveAsync" disabled="@(!CanSave || saving)">
            @(saving ? "Saving..." : "Save Note")
        </button>
        <a class="btn btn-link" href="@(NoteId is null ? "" : $"notes/{NoteId}")">Cancel</a>
    </div>
}

@code {
    // null = create a new note; a number = edit that note.
    [Parameter]
    public int? NoteId { get; set; }

    // ----- Component state: lives on the server for as long as the circuit is open -----
    private Note note = new();
    private List<Category> categories = new();
    private List<int> selectedCategoryIds = new();
    private string newCategoryName = "";
    private bool loading = true;
    private bool saving;

    // ----- Derived values: recomputed every time the component renders -----
    private bool CanSave => !string.IsNullOrWhiteSpace(note.Title) && !string.IsNullOrWhiteSpace(note.Content);

    private int WordCount => note.Content.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length;

    protected override async Task OnInitializedAsync()
    {
        categories = await Notes.GetCategoriesAsync();

        if (NoteId is not null)
        {
            Note? existing = await Notes.GetNoteAsync(NoteId.Value);
            if (existing is null)
            {
                Navigation.NavigateTo(""); // the note was deleted; go home
                return;
            }

            note = existing;
            selectedCategoryIds = note.Categories.Select(c => c.Id).ToList();
        }

        loading = false;
    }

    // ----- Event handlers: after each one finishes, Blazor re-renders automatically -----

    private void ToggleCategory(int categoryId, bool isChecked)
    {
        if (isChecked)
        {
            selectedCategoryIds.Add(categoryId);
        }
        else
        {
            selectedCategoryIds.Remove(categoryId);
        }
    }

    private async Task AddCategoryAsync()
    {
        Category created = await Notes.AddCategoryAsync(newCategoryName.Trim());
        categories.Add(created);
        selectedCategoryIds.Add(created.Id);
        newCategoryName = "";
    }

    private async Task SaveAsync()
    {
        saving = true; // the button shows "Saving..." as soon as this handler awaits
        int id = await Notes.SaveNoteAsync(note, selectedCategoryIds);
        Navigation.NavigateTo($"notes/{id}");
    }
}
```

## 7.3 Host the editor on two pages

**`Components/Pages/Notes/NoteCreate.razor`**

```razor
@page "/notes/new"

<PageTitle>New Note - BlazingNotes</PageTitle>

@* This page is static. Only the NoteEditor component inside it is interactive. *@
<NoteEditor @rendermode="InteractiveServer" />
```

**`Components/Pages/Notes/NoteEdit.razor`**

```razor
@page "/notes/{Id:int}/edit"

<PageTitle>Edit Note - BlazingNotes</PageTitle>

<NoteEditor @rendermode="InteractiveServer" NoteId="Id" />

@code {
    [Parameter]
    public int Id { get; set; }
}
```

There are two ways to make something interactive:

| Syntax | Where | Effect |
|---|---|---|
| `@rendermode InteractiveServer` | A **directive** at the top of a component file, like in the template's `Counter.razor` | That component is *always* interactive |
| `<NoteEditor @rendermode="InteractiveServer" />` | A **directive attribute** where you *use* a component | This *instance* is interactive. The host page and layout stay static. |

We use the second form so the page and layout stay plain server-rendered HTML, and only the editor opens a circuit. `NoteId="Id"` passes a `[Parameter]` from the static page into the interactive component. That works because an `int` can be serialized and sent across.

> **Stuck? Nothing happens when you type or click.** The component isn't interactive. Check that the `@rendermode` is there and spelled correctly, that `Program.cs` still has both `.AddInteractiveServerComponents()` and `.AddInteractiveServerRenderMode()`, and that `App.razor` still loads `blazor.web.js`. Open the browser console (F12) and look for WebSocket errors.

> **Stuck? An error saying a parameter passed to an interactive component "cannot be serialized"?** Parameters passed into an interactive component from a static parent must be plain data: no `RenderFragment` child content and no delegates such as `Func<>` or `EventCallback`.

### Add the links

In **`Home.razor`**, replace the `<h1>` with a header that has a button:

```razor
<div class="d-flex justify-content-between align-items-center mb-4">
    <h1>All Notes</h1>
    <a href="notes/new" class="btn btn-primary">+ New Note</a>
</div>
```

In **`NoteDetail.razor`**, add an Edit button after the `<p class="meta">` paragraph:

```razor
        <a href="notes/@note.Id/edit" class="btn btn-primary">Edit</a>
```

In **`NoteCard.razor`**, add one after the View button:

```razor
    <a href="notes/@Note.Id/edit" class="btn btn-sm btn-outline-secondary">Edit</a>
```

## 7.4 Data binding with `@bind`

```razor
<input @bind="note.Title" @bind:event="oninput" />
```

`@bind` is **two-way binding**:

- **C# → UI:** when the component renders, the input's `value` is set to `note.Title`.
- **UI → C#:** when the browser fires the bound event, the new text is written back to `note.Title`, and then the component re-renders.

`@bind:event` chooses *which* event:

| | Updates the field... | Use for |
|---|---|---|
| `@bind="x"` (default event `onchange`) | when the input **loses focus** (or Enter is pressed) | Most forms. Fewer round trips. |
| `@bind="x" @bind:event="oninput"` | on **every keystroke** | Live counters, previews, enabling buttons as you type |

The title and content use `oninput`, so the word count and the Save button update live. The "New category..." box uses plain `@bind`, so it updates when you leave the box. Try it: type a name, and the **Add** button only enables after you click or tab away.

`@bind` works on `<input>`, `<textarea>`, and `<select>`. For a list like our category checkboxes, there's no single value to bind, so we combine **one-way** binding (`checked="@..."`, C# → UI) with an **event handler** (`@onchange`, UI → C#). That's exactly what `@bind` does for you under the hood.

## 7.5 Event handlers, and what happens after an event

```razor
<button @onclick="SaveAsync">Save Note</button>
<input type="checkbox" @onchange="e => ToggleCategory(category.Id, (bool)e.Value!)" />
```

- `@onclick="SaveAsync"` passes a **method group**. The method can return `void` or `Task`.
- `@onchange="e => ..."` uses a **lambda**, so you can pass extra arguments like `category.Id`. `e` is a `ChangeEventArgs`, and `e.Value` holds the new value: `true` or `false` for a checkbox.

**What happens immediately after a component handles a UI event?**

1. Blazor runs your handler.
2. When the handler finishes, Blazor **automatically calls `StateHasChanged()`**, which re-renders the component.
3. It **diffs** the new render output against the previous one and sends only the changes to the browser.

That's why you never write "update the word count" code. Changing `note.Content` and letting the component re-render is enough. `CanSave` and `WordCount` are *computed properties*, so they're re-evaluated on every render.

**Async handlers render twice.** Look at `SaveAsync`:

```csharp
saving = true;                                               // set state...
int id = await Notes.SaveNoteAsync(note, selectedCategoryIds); // ...first await: Blazor re-renders NOW → "Saving..."
Navigation.NavigateTo($"notes/{id}");
```

When an async handler reaches its first incomplete `await`, Blazor renders right away. The user sees "Saving..." and a disabled button while the database works. This is Lesson 3's `Task` at work in the UI.

> **When do you call `StateHasChanged()` yourself?** Only when state changes *outside* a Blazor event handler, for example in a timer callback. Inside `@onclick` and friends, Blazor does it for you.

## 7.6 State and the circuit

The fields in `@code` (`note`, `categories`, `selectedCategoryIds`, `saving`, ...) are the component's **state**. In an interactive component that state **stays in server memory** between events, for as long as the circuit (the WebSocket) is open. That's the big difference from the static pages, where every request got a brand-new component.

Three consequences:

1. **The server holds memory for each open tab.** That's why we made only the editor interactive rather than the whole site.
2. **Closing the tab or losing the network ends the circuit.** The template's `ReconnectModal` shows a "Reconnecting..." dialog if the connection drops.
3. **Static parts don't update.** Click **Add** to create a category in the editor: it appears in the checkboxes immediately, but **not in the sidebar**. The sidebar belongs to the static layout, which was rendered once by the initial request. After you save, `NavigateTo` loads the next page, the layout renders again, and the new category appears.

This is also where the context factory from Lesson 4 pays off. The editor (and the `NoteService` it injected) can live for as long as the tab is open, but every `NoteService` method still creates and disposes its own short-lived `AppDbContext`.

### Prerendering: why `OnInitializedAsync` runs twice

Look at step 1 in the diagram in 7.1. By default an interactive component is **prerendered**: the server first renders it as static HTML so the page appears instantly, then creates it *again* when the circuit connects. So `OnInitializedAsync` runs **twice** and queries the database twice. Put a `Console.WriteLine("init")` in it and watch the terminal.

Usually that's fine. To turn prerendering off for a component:

```razor
<NoteEditor @rendermode="new InteractiveServerRenderMode(prerender: false)" />
```

Now it runs once, and the user sees "Loading..." until the circuit connects.

## 7.7 Try it

1. Click **+ New Note**. The Save button is disabled. Type a title and some content and watch the word count and the button.
2. Type a category name in the **New category...** box, tab out, and click **Add**. It appears and is ticked. Check the sidebar (no change), then save and check it again.
3. Edit an existing note: its title, content, and categories load into the editor.
4. Open dev tools → **Network** → filter **WS** (WebSocket) → click the `_blazor` connection → **Messages**. Type a character and watch a small message go up and a small patch come back. Compare that with the full-page HTML responses of the static pages.

## 7.8 Delete the template demo

You no longer need `Components/Pages/Counter.razor`. It was the template's example of the same idea. Delete it.

## 7.9 Check your understanding

1. How do you make a component interactive? *(`@rendermode InteractiveServer` at the top of the component, or `@rendermode="InteractiveServer"` where it's used)*
2. What happens immediately after a component handles a UI event? *(Blazor re-renders it automatically, diffs the output, and sends only the changes to the browser)*
3. How do you bind a C# field to a text box so it updates on every keystroke? *(`@bind="field" @bind:event="oninput"`)*
4. Where does an interactive component's state live, and how long? *(In the component's fields in server memory, for the life of the circuit)*
5. Why didn't the sidebar show the category you added in the editor? *(The sidebar is part of the static layout, rendered once per request, not part of the interactive component)*
6. Why does `OnInitializedAsync` run twice in the editor? *(Prerendering: once to produce the initial HTML, once when the circuit starts)*

**Next:** [Lesson 8: Deleting with small forms and `confirmActions.js`](08-deleting.md)
