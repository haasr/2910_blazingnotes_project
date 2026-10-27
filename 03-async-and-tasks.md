# Lesson 3: Synchronous vs. Asynchronous Code and `Task<T>`

From the next lesson on, almost every method you write or call (database queries especially) ends in `Async` and returns a `Task`. This short lesson explains what that means and why web apps rely on it. There's no app code to write here, only ideas you'll use from Lesson 4 onward.

## 3.1 Synchronous code blocks

```csharp
int noteCount = db.Notes.Count();   // synchronous
```

`Count()` sends SQL to the database and then **blocks**: the thread sits idle until the answer comes back. The database might take 1 ms or 500 ms. Either way, that thread can't do anything else in the meantime.

On a web server, threads are a limited, shared resource. The server takes a thread from a **thread pool** to handle each request. If 100 users hit pages that each block a thread for 200 ms waiting on I/O, the pool runs out. New requests queue up, even though the CPU is mostly idle and just *waiting*.

## 3.2 Asynchronous code waits without blocking

```csharp
int noteCount = await db.Notes.CountAsync();   // asynchronous
```

`CountAsync()` starts the query and **immediately returns a `Task<int>`**, a promise of an `int` that will arrive later. `await` then says: *"Pause this method until the task finishes, and give the thread back to the pool in the meantime."* When the database answers, the method **resumes** where it left off, possibly on a different thread, with the result.

```
Synchronous                         Asynchronous
-----------                         ------------
Thread: [send SQL]                  Thread: [send SQL] → returns to pool, serves other requests
Thread: [ wait ......... ]          (no thread is used while waiting)
Thread: [ got result ]              Thread: [ got result ] ← picked up when the DB answers
```

The code still *reads* top to bottom, like synchronous code. That's the point of `async`/`await`.

## 3.3 How `Task` and `Task<T>` work

A `Task` is an object representing **an operation that may not have finished yet**.

| Return type | Meaning | Synchronous equivalent |
|---|---|---|
| `Task` | An operation that will complete, with no result | `void` |
| `Task<T>` | An operation that will complete **with a value of type `T`** | `T` |

A `Task` has a status (running, completed, faulted, canceled). When it's done, it holds either the result or the exception that was thrown. `await` unwraps it:

```csharp
Task<int> pending = db.Notes.CountAsync();   // the query has started; we have a "ticket"
int count = await pending;                   // wait for the result (or rethrow its exception)
```

### Writing your own async method

Here's a method like the ones you'll write in Lesson 4:

```csharp
public async Task<List<Note>> GetRecentNotesAsync()
{
    List<Note> notes = await db.Notes
        .OrderByDescending(n => n.UpdatedAt)
        .Take(5)
        .ToListAsync();     // returns Task<List<Note>>

    return notes;           // you return a List<Note>; the compiler wraps it in a Task
}
```

The rules:

1. A method that uses `await` must be marked **`async`**.
2. An `async` method returns `Task` (no value) or `Task<T>` (a value). Use `async void` **only** for event handlers.
3. By convention, async method names end in **`Async`**.
4. Inside the method you `return` a plain `T`. The compiler builds the `Task<T>` for you.
5. **Async spreads up the call chain.** If you `await` something, your method becomes async, so *its* caller should `await` it too. Don't fight this; let it flow all the way up.

### Avoid blocking on a task

```csharp
int count = db.Notes.CountAsync().Result;   // ❌ blocks a thread AND can deadlock
int count = await db.Notes.CountAsync();    // ✅
```

`.Result` and `.Wait()` turn async code back into blocking code, and in UI frameworks like Blazor they can freeze the app entirely. If you feel the need to use them, make the calling method `async` instead.

### Running independent tasks at the same time

Because a task represents work that's *already running*, you can start several and then wait for all of them:

```csharp
Task<string> a = httpClient.GetStringAsync("https://example.com/a");
Task<string> b = httpClient.GetStringAsync("https://example.com/b");
await Task.WhenAll(a, b);        // total time ≈ the slower of the two, not the sum
```

> ⚠️ **Don't do this with one `AppDbContext`.** A database context handles only one operation at a time. Starting two queries on the same context in parallel throws *"A second operation was started on this context instance before a previous operation completed."* Always `await` each database call before starting the next one.

## 3.4 Where you'll see this in Blazor

Blazor components have async **lifecycle methods**. The one you'll use most:

```csharp
protected override async Task OnInitializedAsync()
{
    notes = await Notes.GetNotesAsync();
}
```

**`OnInitializedAsync` is the standard place to fetch a component's data.** Blazor calls it once when the component is created and waits for the returned `Task` before (or, with streaming, while) rendering the result.

## 3.5 Check your understanding

1. What does `Task<List<Note>>` represent? *(An operation that will eventually produce a `List<Note>`, or an exception)*
2. What happens to the thread while an `await`ed database call is in progress? *(It returns to the pool to serve other work)*
3. Why is `.Result` dangerous? *(It blocks a thread and can deadlock)*
4. Which component lifecycle method is a good place to fetch data? *(`OnInitializedAsync`)*

**Next:** [Lesson 4: Dependency injection and a data access service](04-dependency-injection.md)
