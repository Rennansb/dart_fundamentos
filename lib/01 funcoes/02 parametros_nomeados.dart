double somaDoubles({double? numero1, double? numero2}){

// Parametros Nomeados
// parametros nomeados sao nullables por default
// Parametros nomeados podem ser promovidos para non-null checagem de null
print('');
print('Parametros Nomeados');

return numero1 != null && numero2 != null ? (numero1 + numero2) : numero1 != null ? (numero1) : numero2 != null ? (numero2): 0;
print('');

}