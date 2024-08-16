# Model PTU Cost Calculator

## Introduction

This project is designed to calculate the cost of using different AI models based on their token usage and PTU (Processing Time Unit) costs. It utilizes various libraries such as `streamlit`, `pandas`, `openpyxl`, and `xlsxwriter` to achieve its functionality.

## Installation Guide

To set up the project, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   cd your-repo-name
   ```

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```bash
   streamlit run app.py
   ```

Replace `yourusername` and `your-repo-name` with your actual GitHub username and repository name.

## Usage

### Streamlit Web Application

1. Open your web browser and navigate to the Streamlit application.
2. Use the sidebar to input the following parameters:
   - **Input Token Number**: The number of input tokens.
   - **Output Token Number**: The number of output tokens.
   - **RPM (Request per minute)**: The number of requests per minute.
   - **Model Name**: Select the model from the dropdown list.
   - **PTU Number**: The number of PTUs.
   - **PTU Subscription Type**: Choose between "Monthly" or "Yearly".

3. Click on "Add Compare" to calculate and add the results to the comparison table.
4. Click on "Clear Result" to clear the comparison table.
5. If the comparison table is not empty, click on "Export to Excel" to download the results as an Excel file.

### Command Line Interface

You can also use the command line interface to calculate the costs. Run the following command:

```bash
python app.py --input_token <input_token> --output_token <output_token> --rpm <rpm> --model_name <model_name> --ptu_num <ptu_num> --ptu_subscription_type <ptu_subscription_type> --ptu_price_per_unit <ptu_price_per_unit>
```

Replace the placeholders with your actual values.