import streamlit as st
import json
import os
from utils import calculate_google_ptu_num, calculate_ptu_utilization, calculate_paygo_cost, calculate_ptu_cost, calculate_cost_saving_percentage, calculate_azure_openai_ptu_num, calculate_gemini_image_token, calculate_gpt4o_image_token_number
from calculate_image_token import calculate_token_number

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

st.sidebar.title("Select model and workload scenario")
model_name = st.sidebar.selectbox("Model Name", model_list)
input_text_token = st.sidebar.number_input("Input Token Number", min_value=0, value=3500)
num_images = st.sidebar.number_input("Number of Images", min_value=0, value=0)

image_params = []
for i in range(num_images):
    st.sidebar.markdown(f"**Image {i + 1} Parameters**")
    width = st.sidebar.number_input(f"Image {i + 1} Width (px)", min_value=1, value=1024)
    height = st.sidebar.number_input(f"Image {i + 1} Height (px)", min_value=1, value=768)
    quality = st.sidebar.selectbox(f"Image {i + 1} Quality", ["low", "high"])
    image_params.append((width, height, quality))
output_token = st.sidebar.number_input("Output Token Number", min_value=0, value=300)
rpm = st.sidebar.number_input("RPM (Request per minute)", min_value=0, value=60)
if "google" in model_name.lower():
    selected_model_config = next((model for model in model_config if model["model name"] == model_name), None)
    output_token_multiple_ratio = selected_model_config["output token multiple ratio"]
    chars_per_gsu = selected_model_config["chars per GSU"]
    total_image_token = 0
    for width, height, quality in image_params:
        if "gpt-4o" in model_name.lower() or "gpt-4o mini" in model_name.lower():
            total_image_token += calculate_token_number(width, height, quality, model_name)
        else:
            total_image_token += calculate_gemini_image_token(width, height, quality, model_name)
    ptu_num = calculate_google_ptu_num(input_text_token, total_image_token, output_token, rpm, output_token_multiple_ratio, chars_per_gsu)
    st.sidebar.write(f"Required PTU Number: {ptu_num:.2f}")
elif "gpt-4o" in model_name.lower():
    total_image_token = 0
    for width, height, quality in image_params:
        total_image_token += calculate_gpt4o_image_token_number(width, height, quality, model_name)
    deploy_ptu_num, require_ptu_num, total_input_tpm, total_output_tpm, total_tokens_per_minute = calculate_azure_openai_ptu_num(model_name, input_text_token, total_image_token, output_token, rpm)
    st.sidebar.write(f"Required PTU Number: {deploy_ptu_num:.2f} ({require_ptu_num:.3f})")
    st.sidebar.write(f"Tokens per minute : {total_tokens_per_minute} ({total_input_tpm} prompt, {total_output_tpm} generated)")
    ptu_num = deploy_ptu_num
else:
    ptu_num = st.sidebar.number_input("Required PTU Number", min_value=1.0, value=100.0, format="%.2f")

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
        paygo_cost = calculate_paygo_cost(input_text_token, output_token, rpm, model_name)
        ptu_discount = selected_model_config[f"PTU {ptu_subscription_type.lower()} discount"]
        ptu_cost = calculate_ptu_cost(ptu_num_calculated, min_ptu_deployment_unit, ptu_price_per_unit, ptu_discount)
        cost_saving_percentage = calculate_cost_saving_percentage(ptu_cost, paygo_cost)

        # Calculate detailed PayGO cost breakdown
        input_cost, output_cost, total_cost = calculate_paygo_cost(input_text_token, output_token, rpm, model_name, detailed=True)
        origial_cost, cost_after_discount = calculate_ptu_cost(ptu_num_calculated, min_ptu_deployment_unit, ptu_price_per_unit, ptu_discount, detailed=True)

        with st.container(border=True):
            st.sidebar.divider()
        # Display detailed PayGO cost breakdown
            st.sidebar.markdown(f"<p style='color:darkgreen;'>PayGO Cost Breakdown:</p>", unsafe_allow_html=True)
            st.sidebar.markdown(f"<p style='color:darkgreen;'>Input Cost:<br>{input_cost}</p>", unsafe_allow_html=True)
            st.sidebar.markdown(f"<p style='color:darkgreen;'>Output Cost:<br>{output_cost}</p>", unsafe_allow_html=True)
            st.sidebar.markdown(f"<p style='color:darkgreen;'>Total PayGO Cost:<br>{total_cost}</p>", unsafe_allow_html=True)
            st.sidebar.divider()
            st.sidebar.markdown(f"<p style='color:darkgreen;'>PTU Cost Breakdown:</p>", unsafe_allow_html=True)
            st.sidebar.markdown(f"<p style='color:darkgreen;'>Cost before discount:<br>{origial_cost}<br>After Discount:<br>{cost_after_discount}</p>", unsafe_allow_html=True)

        new_result = {
            "Model Name": model_name,
            "Input Token Number": input_text_token,
            "Output Token Number": output_token,
            "RPM": rpm,
            "Commitment Type": ptu_subscription_type,
            "Required PTU Num": ptu_num_calculated,
            "PTU Utilization": ptu_utilization,
            "PayGO cost": paygo_cost,
            "PTU cost": ptu_cost,
            "PTU Cost Saving (%)": cost_saving_percentage,
        }
        # Append new result to the results list
        st.session_state.results_list.append(new_result)

with col2:
    if st.button("Clear Result"):
        st.session_state.results_list = []

# Convert results list to a DataFrame
import pandas as pd
results_df = pd.DataFrame(st.session_state.results_list)


# Function to apply styles based on model name and cost saving percentage
def style_rows(row):
    styles = [''] * len(row)
    if "azure" in row["Model Name"].lower():
        styles = ['background-color: white'] * len(row)
    elif "google" in row["Model Name"].lower():
        styles = ['background-color: lightyellow'] * len(row)
    
    # Apply color to the "Cost Saving (%)" column based on its value
    cost_saving_percentage = float(row["PTU Cost Saving (%)"].strip('%'))
    if cost_saving_percentage > 0:
        styles[-1] = 'background-color: lightgreen'
    else:
        # change the text color to white if the cost saving percentage is negative
        styles[-1] = 'background-color: orange ; color: white'
    
    return styles

if not results_df.empty:
    # Apply the row styles, header styles, and format to two decimal places
    styled_df = results_df.style.apply(style_rows, axis=1).set_table_styles(
        [{'selector': 'th', 'props': [('font-weight', 'bold'), ('color', 'Blue')]}]
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

        # Generate the filename with the current timestamp
        from datetime import datetime
        current_time = datetime.now().strftime("%Y-%m-%d-%H:%M")
        filename = f"ptu-cost-compare-{current_time}.xlsx"

        # Provide a download link for the Excel file with the generated filename
        st.download_button(
            label="Download Excel file",
            data=buffer,
            file_name=filename,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

st.divider()        


# Display instructions for calculating PayGO cost
with st.container(border=True):
    st.title("Reference Info")
    # Display instructions for calculating PTU utilization
    st.divider()
    st.subheader("1. How to calculate PTU Utilization(All Models):")
    
    st.latex(r"""
\begin{aligned}
\text{PTU Utilization} &= \frac{\text{Required PTU Number}}{\left( \left\lceil \frac{\text{Required PTU Number}}{\text{PTU Minimum Deployment Unit}} \right\rceil \times \text{PTU Minimum Deployment Unit} \right)}
\end{aligned}
""")
    st.divider()

    st.subheader("2. How to calculate PayGO Monthly Cost(All Models):")
    st.latex(r"""
\begin{aligned}
\text{Input Cost} &= \left( \frac{\text{Input Tokens} \times \left( \frac{\text{RPM}}{60} \right) \times 3600 \times 24 \times 30.42}{1000} \right) \times \text{Input Token Price per 1k}
\end{aligned}
""")

    st.latex(r"""
\begin{aligned}
\text{Output Cost} &= \left( \frac{\text{Output Tokens} \times \left( \frac{\text{RPM}}{60} \right) \times 3600 \times 24 \times 30.42}{1000} \right) \times \text{Output Token Price per 1k}
\end{aligned}
""")

    st.latex(r"""
\begin{aligned}
\text{Total PayGO Cost} &= \text{Input Cost} + \text{Output Cost}
\end{aligned}
""")

    st.divider()


# Display instructions for calculating PTU number
    st.subheader("3. How to estimate PTU Number(Only Google Gemini Models):")
    st.latex(r"""
\begin{aligned}
\text{PTU Number} &= \left( \frac{(\text{Input Tokens} + (\text{Output Tokens} \times \text{Output Token Multiple Ratio})) \times 4 \times \left( \frac{\text{RPM}}{60} \right)}{\text{Chars per GSU}} \right)
\end{aligned}
""")
    st.markdown("[Google Cloud Model Price doc](https://cloud.google.com/vertex-ai/generative-ai/pricing#gemini-models)")
    st.markdown("[Google Cloud Provisioned Throughput doc](https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput)")


with st.container(border=True):
    st.subheader("Model price Configuration list")
    st.json(model_config)


