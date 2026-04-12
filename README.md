# Concert Archive GitHub Pages Setup

## Files

Place these files in the root of your GitHub repository:

- `index.html`
- `styles.css`
- `script.js`
- `Events_Database.csv`

## What the site does

- Searches your archive by text.
- Filters by Type, Festival, Year, and Photo presence.
- Shows historical highlights for today and this week.
- Hides Week Number and Day Number from the result cards.

## Steps to publish on GitHub Pages

1. Go to GitHub and create a new repository, or open the repository you want to use.
2. Upload `index.html`, `styles.css`, `script.js`, and `Events_Database.csv` to the repository root.
3. Commit the files.
4. Open the repository **Settings**.
5. Click **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select your main branch and the `/ (root)` folder.
8. Save the settings.
9. Wait a minute or two, then refresh the Pages URL GitHub gives you.

## Important notes

- The file name must stay exactly `Events_Database.csv` unless you also change `CSV_PATH` inside `script.js`.
- The CSV should be in the repository root, not inside a subfolder.
- If you later add photos, populate the `Photo URL` column and the site can begin showing them without redesigning the page.

## Updating the site later

When you edit the CSV or code:

1. Make changes locally or in GitHub.
2. Commit and push.
3. GitHub Pages will rebuild automatically.
