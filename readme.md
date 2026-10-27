# Learn Blazor by Building BlazingNotes

BlazingNotes is a note-taking Blazor Web App (.NET 10), built as a teaching project. It shows statically rendered, request/response Razor pages next to an interactive, data-bound component (the note editor), with EF Core and SQLite behind a small data access service.

## Lessons

Start at [01-project-tour.md](01-project-tour.md).

1. [Creating the project and touring a Blazor Web App](01-project-tour.md)
2. [Models, the database context, and migrations](02-models-and-database.md)
3. [Synchronous vs. asynchronous code and `Task<T>`](03-async-and-tasks.md)
4. [Dependency injection and a data access service](04-dependency-injection.md)
5. [Server-rendered pages, routing, and `[Parameter]`](05-pages-and-parameters.md)
6. [Layouts and `[CascadingParameter]`](06-layouts-and-cascading-parameters.md)
7. [Interactive components: `@rendermode InteractiveServer` and data binding](07-interactive-note-editor.md)
8. [Deleting with small forms and `confirmActions.js`](08-deleting.md)
9. [Review: questions and answers](09-review.md)

Starter files (stylesheet, layout, and `confirmActions.js`) are in [starter/](starter/).
