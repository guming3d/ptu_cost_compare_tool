import streamlit as st
import json
import os
from utils import calculate_ptu_num, calculate_ptu_utilization, calculate_paygo_cost, calculate_ptu_cost, calculate_cost_saving_percentage

# Load model configuration
config_path = os.path.join(os.path.dirname(__file__), 'model_config.json')
with open(config_path, 'r') as f:
    model_config = json.load(f)

# Extract model names for dropdown
model_list = [model["model name"] for model in model_config]

# Initialize an empty list to store results in session state if not already present
if 'results_list' not in st.session_state:
    st.session_state.results_list = []

# Streamlit UI
st.set_page_config(
    page_title="AI GBB PTU price comparation",
    layout="wide",  # You can also choose 'wide'
)
st.title("Model PTU Cost Calculator(Monthly)")

model_name = st.sidebar.selectbox("Model Name", model_list)
input_token = st.sidebar.number_input("Input Token Number", min_value=0, value=3500)
output_token = st.sidebar.number_input("Output Token Number", min_value=0, value=300)
rpm = st.sidebar.number_input("RPM (Request per minute)", min_value=0, value=60)
if "google" in model_name.lower():
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    output_token_multiple_ratio = selected_model_config["output token multiple ratio"]
    chars_per_gsu = selected_model_config["chars per GSU"]
    ptu_num = calculate_ptu_num(input_token, output_token, rpm, output_token_multiple_ratio, chars_per_gsu)
    st.sidebar.write(f"PTU Number: {ptu_num:.2f}")
else:
    ptu_num = st.sidebar.number_input("PTU Number", min_value=1.0, format="%.2f")
ptu_subscription_type = st.sidebar.selectbox("PTU Subscription Type", ["Monthly", "Yearly"])

if model_name:
    # Get model-specific configuration
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    if selected_model_config:
        min_ptu_deployment_unit = selected_model_config["PTU minumum deployment unit"]
        ptu_price_per_unit = selected_model_config[f"PTU price of {ptu_subscription_type.lower()} commitment"]

# Add custom CSS for button styling
st.markdown("""
    <style>
    .stButton button {
        background-color: #4CAF50; /* Green */
        border: none;
        color: white;
        padding: 10px 24px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 12px;
    }
    </style>
    """, unsafe_allow_html=True)



# Place buttons side by side
col1, col2 = st.sidebar.columns(2)
with col1:
    if st.button("Add Compare"):
        ptu_num_calculated = ptu_num
        ptu_utilization = calculate_ptu_utilization(ptu_num_calculated, min_ptu_deployment_unit)
        paygo_cost = calculate_paygo_cost(input_token, output_token, rpm, model_name)
        ptu_discount = selected_model_config[f"PTU {ptu_subscription_type.lower()} discount"]
        ptu_cost = calculate_ptu_cost(ptu_num_calculated, min_ptu_deployment_unit, ptu_price_per_unit, ptu_discount)
        cost_saving_percentage = calculate_cost_saving_percentage(ptu_cost, paygo_cost)

        new_result = {
            "Model Name": model_name,
            "Input Token Number": input_token,
            "Output Token Number": output_token,
            "RPM": rpm,
            "Commitment Type": ptu_subscription_type,
            "PTU Num": ptu_num_calculated,
            "PTU Utilization": ptu_utilization,
            "PayGO cost": paygo_cost,
            "PTU cost": ptu_cost,
            "Cost Saving (%)": cost_saving_percentage,
        }
        # Append new result to the results list
        st.session_state.results_list.append(new_result)

with col2:
    if st.button("Clear Result"):
        st.session_state.results_list = []

# Convert results list to a DataFrame
import pandas as pd
results_df = pd.DataFrame(st.session_state.results_list)

# Function to apply row styles based on model name
def style_rows(row):
    if "azure" in row["Model Name"].lower():
        return ['background-color: lightgreen'] * len(row)
    elif "google" in row["Model Name"].lower():
        return ['background-color: lightyellow'] * len(row)
    else:
        return [''] * len(row)

if not results_df.empty:
    # Apply the row styles, header styles, and format to two decimal places
    styled_df = results_df.style.apply(style_rows, axis=1).set_table_styles(
        [{'selector': 'th', 'props': [('font-weight', 'bold'), ('color', 'black')]}]
    ).format(precision=2)

    # Display the styled DataFrame
    st.dataframe(styled_df)

# If results are not empty, display "Export to Excel" button
if not results_df.empty:
    if st.button("Export to Excel", key="export_to_excel"):
        import io
        from pandas import ExcelWriter

        # Create a BytesIO buffer to hold the Excel file
        buffer = io.BytesIO()

        # Write the DataFrame to the buffer
        with ExcelWriter(buffer, engine='xlsxwriter') as writer:
            results_df.to_excel(writer, index=False, sheet_name='Results')

        # Set the buffer's position to the beginning
        buffer.seek(0)

        # Provide a download link for the Excel file
        st.download_button(
            label="Download Excel file",
            data=buffer,
            file_name="results.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

st.divider()        


# Display instructions for calculating PayGO cost
with st.container(border=True):
    st.subheader("PayGO Monthly Cost Calculation Instructions")

    st.latex(r"""
\begin{aligned}
\text{Output Cost} &= \left( \frac{\text{Output Tokens} \times \left( \frac{\text{RPM}}{60} \right) \times 3600 \times 24 \times 30}{1000} \right) \times \text{Output Token Price per 1k}
\end{aligned}
""")



# Display instructions for calculating PTU number
    st.subheader("Google PTU Number Calculation Instructions")
    st.latex(r"""
\begin{aligned}
\text{PTU Number} &= \left( \frac{(\text{Input Tokens} + (\text{Output Tokens} \times \text{Output Token Multiple Ratio})) \times 4 \times \left( \frac{\text{RPM}}{60} \right)}{\text{Chars per GSU}} \right)
\end{aligned}
""")
    st.latex(r"""
\begin{aligned}
\text{Total PayGO Cost} &= \text{Input Cost} + \text{Output Cost}
\end{aligned}
""")

# Display instructions for calculating PTU utilization
    st.subheader("PTU Utilization Calculation Instructions")
    st.latex(r"""
\begin{aligned}
\text{PTU Utilization} &= \frac{\text{PTU Number}}{\left( \left\lceil \frac{\text{PTU Number}}{\text{PTU Minimum Deployment Unit}} \right\rceil \times \text{PTU Minimum Deployment Unit} \right)}
\end{aligned}
""")


