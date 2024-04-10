import { Box, Typography, useTheme } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { tokens } from '../../theme';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import { Helmet } from 'react-helmet';
import { useGetPoRegisterQuery } from '../../redux/service/poRegister';
import { useMemo, useState } from 'react';
import { filterSearch } from '../../helper/helper';
import { useGetFinYearQuery } from '../../redux/service/finYear';
import { isDate, keyBy } from 'lodash';
import { getMonthValue } from '../../helper/date';

const Team = () => {
  const [year, setYear] = useState('')
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { data, isLoading, isFetching } = useGetPoRegisterQuery();
  const { data: finYear } = useGetFinYearQuery();

  let poData = useMemo(() => data?.data ? data.data : [], [data])
  poData = filterSearch(
    [
      { field: "poDate", searchValue: year, isDate: true },
    ],
    poData
  );

  console.log(year, 'jkj');

  poData = poData.map((row) => ({
    ...row,
    poDate: getMonthValue(row.poDate),
    dueDate: getMonthValue(row.dueDate),
  }));
  const columns = [
    { field: 'poNo', headerName: 'PO Number', flex: 1 },
    { field: 'poDate', headerName: 'PO Date', flex: 1 },
    { field: 'dueDate', headerName: 'Due Date', flex: 1 },
    { field: 'supplier', headerName: 'Supplier', flex: 1 },
    { field: 'totalQty', headerName: 'Total Quantity', type: 'number', flex: 1 },
    { field: 'transaction', headerName: 'Transaction', flex: 1 },
    {
      field: 'access',
      headerName: 'Access Level',
      flex: 1,
      renderCell: ({ row: { access } }) => (
        <>
          <Helmet>
            <title>Team | ReactDashX</title>
          </Helmet>
          <Box
            width="60%"
            m="0 auto"
            p="5px"
            display="flex"
            justifyContent="center"
            backgroundColor={
              access === 'admin' ? colors.greenAccent[600] : colors.greenAccent[700]
            }
            borderRadius="4px"
          >
            {access === 'admin' && <AdminPanelSettingsOutlinedIcon />}
            {access === 'manager' && <SecurityOutlinedIcon />}
            {access === 'user' && <LockOpenOutlinedIcon />}
            <Typography color={colors.grey[100]} sx={{ ml: '5px' }}>
              {access}
            </Typography>
          </Box>
        </>
      ),
    },
  ];

  const getRowId = (row) => row.poNo; // Assuming 'poNo' is unique for each row

  return (
    <div>
      <ul className='flex mx-5 '>
        {(finYear?.data ? finYear.data : []).map((item, index) => (
          <li
            className='bg-green-200 hover:bg-green-500 mx-2 rounded-lg p-1'
            onClick={() => setYear(item.finYear.toString())}
            key={index}
          >
            {item.finYear}
          </li>

        ))}
      </ul>

      <Box mx={'10px'}>
        <Box
          m="1px 0 0 0"
          height="80vh"
          sx={{
            '& .MuiDataGrid-root': {
              border: '1px',
            },
            '& .MuiDataGrid-cell': {
              border: '1px',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: colors.blueAccent[900],
              border: '1px',
            },
            '& .MuiDataGrid-virtualScroller': {
              backgroundColor: colors.primary[400],
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: 'none',
              backgroundColor: colors.blueAccent[900],
            },
          }}
        >
          <DataGrid
            rows={poData}
            columns={columns}
            getRowId={getRowId}
            loading={isLoading || isFetching}
          />
        </Box>
      </Box></div>
  );
};

export default Team;
