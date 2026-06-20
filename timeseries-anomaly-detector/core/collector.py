import pandas as pd
import os
import glob


class DataCollector:
    def __init__(self, data_dir, timestamp_column='timestamp'):
        self.data_dir = data_dir
        self.timestamp_column = timestamp_column

    def load_all_csv(self):
        if not os.path.isdir(self.data_dir):
            raise FileNotFoundError(f"Data directory not found: {self.data_dir}")

        csv_files = glob.glob(os.path.join(self.data_dir, '*.csv'))
        if not csv_files:
            raise FileNotFoundError(f"No CSV files found in {self.data_dir}")

        dataframes = []
        metric_names = []

        for csv_file in sorted(csv_files):
            df = pd.read_csv(csv_file)
            metric_name = os.path.splitext(os.path.basename(csv_file))[0]
            df.columns = [col.strip() for col in df.columns]

            if self.timestamp_column not in df.columns:
                raise ValueError(
                    f"Timestamp column '{self.timestamp_column}' not found in {csv_file}. "
                    f"Available columns: {list(df.columns)}"
                )

            df[self.timestamp_column] = pd.to_datetime(df[self.timestamp_column])
            df = df.sort_values(self.timestamp_column).reset_index(drop=True)

            value_cols = [col for col in df.columns if col != self.timestamp_column]
            if len(value_cols) == 0:
                raise ValueError(f"No value columns found in {csv_file}")

            for val_col in value_cols:
                col_name = f"{metric_name}_{val_col}" if len(value_cols) > 1 else metric_name
                temp_df = df[[self.timestamp_column, val_col]].copy()
                temp_df.columns = [self.timestamp_column, col_name]
                dataframes.append(temp_df)
                metric_names.append(col_name)

        merged_df = self._align_by_timestamp(dataframes)
        return merged_df, metric_names

    def _align_by_timestamp(self, dataframes):
        if not dataframes:
            return pd.DataFrame()

        result = dataframes[0]
        for i in range(1, len(dataframes)):
            result = pd.merge(
                result,
                dataframes[i],
                on=self.timestamp_column,
                how='outer'
            )

        result = result.sort_values(self.timestamp_column).reset_index(drop=True)
        result = result.ffill().bfill()

        return result
