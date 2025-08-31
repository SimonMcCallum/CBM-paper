import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

def create_ai_scatter_plot(csv_path):
    # Read the CSV file
    df = pd.read_csv(csv_path)
    
    # Clean the data - ensure numeric conversion
    df['confidence score'] = pd.to_numeric(df['confidence score'].replace('-', np.nan), errors='coerce')
    df['number correct'] = pd.to_numeric(df['number correct'].replace('-', np.nan), errors='coerce')
    
    # Drop rows where either confidence score or number correct is NaN
    df = df.dropna(subset=['confidence score', 'number correct'])
    
    # Create a figure with larger size
    plt.figure(figsize=(12, 8))
    
    # Define colors for different AI systems
    colors = {
        'ChatGPT': '#00A67E',  # Green
        'Gemini': '#4285F4',   # Blue
        'Claude': '#7F25D9',   # Purple
        'Deepseek': '#FF6B6B'  # Red
    }
    
    # Plot first 19 candidates
    plt.scatter(df['number correct'].iloc[:19], 
               df['confidence score'].iloc[:19], 
               color='gray',
               alpha=0.6,
               label='Candidates')
    
    # Plot AI systems (remaining points)
    ai_data = df.iloc[19:]
    
    # Calculate label positions with different offsets
    offsets = [(30, 30), (-30, 30), (30, -30), (-30, -30)]
    offset_idx = 0
    
    # Create scatter plots for each AI system
    for ai_name, color in colors.items():
        mask = ai_data['Navn'].astype(str).str.contains(ai_name, case=False, na=False)
        if mask.any():
            ai_points = ai_data[mask]
            plt.scatter(ai_points['number correct'], 
                       ai_points['confidence score'],
                       color=color,
                       label=ai_name,
                       s=100)  # Larger point size for AI systems
            
            # Add labels for AI points with offset lines
            for idx, row in ai_points.iterrows():
                x = row['number correct']
                y = row['confidence score']
                
                # Get current offset
                x_offset, y_offset = offsets[offset_idx % len(offsets)]
                
                # Draw the connection line
                plt.annotate(row['Navn'],
                           xy=(x, y),
                           xytext=(x_offset, y_offset),
                           textcoords='offset points',
                           fontsize=8,
                           bbox=dict(boxstyle='round,pad=0.5', fc='white', alpha=0.7, edgecolor='none'),
                           arrowprops=dict(arrowstyle='-',
                                         connectionstyle='arc3,rad=0.2',
                                         color='gray',
                                         alpha=0.6))
                
                offset_idx += 1
    
    # Add the three line segments
    plt.plot([0, 5], [0, 5], 'k--', alpha=0.5)  # Line from (0,0) to (5,5)
    plt.plot([5, 7.5], [5, 10.75], 'k--', alpha=0.5)  # Line from (5,5) to (7.5,10.75)
    plt.plot([7.5, 10], [10.75, 20], 'k--', alpha=0.5)  # Line from (7.5,10.75) to (10,20)
    
    # Customize the plot
    plt.xlabel('Number Correct')
    plt.ylabel('Confidence Score')
    plt.title('Confidence Score vs Number Correct: Candidates and AI Systems')
    
    # Set axes to start from 0
    x_max = float(max(max(df['number correct']), 10))
    y_max = float(max(max(df['confidence score']), 20))
    plt.xlim(0, x_max * 1.1)
    plt.ylim(0, y_max * 1.1)
    
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Add a light gray background grid
    plt.grid(True, linestyle='--', alpha=0.3)
    
    # Tight layout to prevent label clipping
    plt.tight_layout()
    
    # Save the plot
    plt.savefig('scatter_plot.png', dpi=300, bbox_inches='tight')
    plt.close()


# Create the plot
create_ai_scatter_plot('CBM_Assessment.csv')