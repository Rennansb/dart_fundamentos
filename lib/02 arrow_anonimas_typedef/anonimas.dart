main(){



(){
print("Funcão anonima");
}();

var funcaoQualQuer = (){
return "teste";
};

print(funcaoQualQuer());


print('Iniciando Chamada');
chamarUmaFuncaoDeUmParametro((nome){
if(nome.isEmpty){
print('Nome veio vazio');

} else{
print(nome);
}
});
print('Finalizando Chamada');
}

void chamarUmaFuncaoDeUmParametro(Function(String nome) funcaoQueRecebeONome){
var calculo = 1+1;
var nomeCompleto = 'Rennan';
print('Finalizando a funcao chamarUmaFuncaoDeUmParametro');
print('invocando funcaoQueRecebeONome');
funcaoQueRecebeONome(nomeCompleto);
}