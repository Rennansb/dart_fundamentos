void main(){



var numeros = List.generate(10, (index)=> index);

numeros.forEach(printAcademia);

// Expand
// Array BiDimencional

var lista = [
[1,2,],
[3,4],

];

print(lista[0][0]);


var listaNova = [...lista[0], ...lista[1]];

print(listaNova);



// Expand

var listaNova2 = lista.expand((numeros) => numeros).toList();
print(listaNova2);




// Any

final listaBusca = ['Rodrigo', 'João', 'José'];

if(listaBusca.any((nome)=> nome == 'João')){
print("Tem João");
} else{

print("Não tem João");
}


// every



final listaBusca2 = ['Rodrigo', 'João', 'José'];


if(listaBusca2.every((nome)=> nome.contains("o"))){

print("Todos os nomes tem a letra o");

}else{
print("Nem todos os nomes tem a letra o");


}


// Sort Lista para ordenação

var listaParaOrdenacao = [99,22,10,765,1,2,3,100,300];


listaParaOrdenacao.sort();

print(listaParaOrdenacao);

var listaNomesOrdenacao =  ['Rodrigo', 'João', 'José'];

listaNomesOrdenacao.sort();

print(listaNomesOrdenacao);



// CompareTo com Sort

var listaPacientes = [

'Rodrigo Ra |37',
'Luana|35',
'Guilherme|18',
'Artur|5',
'Joaquim|5',
'Antonio|50',



];


listaPacientes.sort((paciente1, paciente2){
final pacienteDados1 = paciente1.split('|');
final pacienteDados2 = paciente2.split('|');

final idadePaciente1 = int.parse(pacienteDados1[1]);

final idadePaciente2 = int.parse(pacienteDados2[1]);


if(idadePaciente1 > idadePaciente2){
return 1;
}else if(idadePaciente1 == idadePaciente2){
return 0;
}else{
return -1;
}

});

print(listaPacientes);



// CompareTo com Sort

var listaPacientes2 = [

'Rodrigo Ra |37',
'Luana|35',
'Guilherme|18',
'Artur|5',
'Joaquim|5',
'Antonio|50',



];

listaPacientes2.sort((paciente1, paciente2){
final pacienteDados1 = paciente1.split('|');
final pacienteDados2 = paciente2.split('|');

final idadePaciente1 = int.parse(pacienteDados1[1]);

final idadePaciente2 = int.parse(pacienteDados2[1]);


return idadePaciente1.compareTo(idadePaciente2);

});

print(listaPacientes2);







}


void printAcademia(int valor){
print(valor);}