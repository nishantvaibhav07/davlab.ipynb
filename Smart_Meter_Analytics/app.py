
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from pathlib import Path
import pandas as pd

app = Flask(__name__)
app.secret_key = "smart-meter-dashboard-key"

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(exist_ok=True)

DATA_FILE = UPLOAD_FOLDER / "dataset.csv"
REQUIRED_COLUMNS = ["Sentiment", "Platform", "Country"]


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_dataset():
    file = request.files.get("dataset")

    if file is None or file.filename == "":
        flash("Please select a CSV file.")
        return redirect(url_for("home"))

    if not file.filename.lower().endswith(".csv"):
        flash("Please upload a CSV file.")
        return redirect(url_for("home"))

    try:
        df = pd.read_csv(file)
        df.columns = df.columns.str.strip()

        if df.empty:
            flash("The CSV file is empty.")
            return redirect(url_for("home"))

        missing = [
            col for col in REQUIRED_COLUMNS
            if col not in df.columns
        ]

        if missing:
            flash("Missing required columns: " + ", ".join(missing))
            return redirect(url_for("home"))

        df.to_csv(DATA_FILE, index=False)
        flash(f"Dataset uploaded successfully: {len(df):,} records.")

    except Exception as error:
        flash(f"Could not read CSV: {error}")

    return redirect(url_for("home"))


@app.route("/api/data")
def api_data():
    if not DATA_FILE.exists():
        return jsonify({"loaded": False, "rows": []})

    try:
        df = pd.read_csv(DATA_FILE)
        df.columns = df.columns.str.strip()

        for col in ["Likes", "Retweets"]:
            if col not in df.columns:
                df[col] = 0

            df[col] = pd.to_numeric(
                df[col], errors="coerce"
            ).fillna(0)

        df["Engagement"] = df["Likes"] + df["Retweets"]

        for col in ["Sentiment", "Platform", "Country", "Hashtags"]:
            if col not in df.columns:
                df[col] = "Unknown"

            df[col] = (
                df[col].fillna("Unknown").astype(str).str.strip()
            )
            df.loc[df[col] == "", col] = "Unknown"

        if "Timestamp" in df.columns:
            dates = pd.to_datetime(df["Timestamp"], errors="coerce")
            df["MonthYear"] = dates.dt.strftime("%Y-%m")
            df["MonthYear"] = df["MonthYear"].fillna("Unknown")
        else:
            df["MonthYear"] = "Unknown"

        df = df.astype(object).where(pd.notna(df), None)

        return jsonify({
            "loaded": True,
            "rows": df.to_dict(orient="records")
        })

    except Exception as error:
        return jsonify({
            "loaded": False,
            "rows": [],
            "error": str(error)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
