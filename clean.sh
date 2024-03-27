#!/bin/bash

# Get the directory path from the command line argument
directory=$1

# Sort the files and directories in the given directory by name
# shellcheck disable=SC2012
sorted_files=$(ls -1 "$directory" | sort)

# Calculate the number of files and directories in the given directory
num_files=$(echo "$sorted_files" | wc -l)

# Calculate the number of files and directories to keep
num_to_keep=30

# Calculate the number of files and directories to delete
num_to_delete=$((num_files - num_to_keep))

# Delete the extra files and directories
if [ $num_to_delete -gt 0 ]; then
    echo "Deleting $num_to_delete files and directories..."
    echo "$sorted_files" | head -n $num_to_delete | xargs -I {} rm -rf "$directory/{}"
fi

# Check the total size of the remaining files and directories
# total_size=$(du -sh "$directory" | awk '{print $1}')

# # Calculate the maximum size in GB
# max_size=50

# # Convert the total size to GB
# total_size_gb=$(echo "scale=2; $total_size / 1024" | bc)

# # Delete files and directories until the total size is less than the maximum size
# while (( $(echo "$total_size_gb > $max_size" | bc -l) )); do
#     echo "Total size: $total_size_gb GB"
#     echo "Deleting files and directories to reduce the size..."

#     # Delete the oldest file or directory
#     # shellcheck disable=SC2012
#     oldest_file=$(ls -1t "$directory" | tail -n 1)
#     # shellcheck disable=SC2115
#     rm -rf "$directory/$oldest_file"

#     # Recalculate the total size
#     total_size=$(du -sh "$directory" | awk '{print $1}')
#     total_size_gb=$(echo "scale=2; $total_size / 1024" | bc)
# done

echo "Cleanup completed."